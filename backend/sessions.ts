import { and, eq, gt, gte, inArray, isNull, lt, or } from "drizzle-orm";
import * as oidc from "openid-client";
import { z } from "zod";

import { decrypt, encrypt, randomToken, tokenHash } from "#backend/crypto";
import type { DatabaseTransaction } from "#backend/database";
import { db } from "#backend/database";
import { ApplicationError } from "#backend/errors";
import { pick } from "#backend/utils";
import { logoutTokens, sessions } from "#database/schema";
import type { User } from "#shared/user";

import { identityClient } from "./oidc.ts";

interface Tokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

const persistedTokens = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  idToken: z.string().min(1),
});

type OidcTokens = oidc.TokenEndpointResponse &
  oidc.TokenEndpointResponseHelpers;

const sessionRetention = 14 * 24 * 60 * 60 * 1000;

const logoutRetention = 12 * 60 * 60;

export function idTokenClaims(tokens: OidcTokens) {
  const claims = tokens.claims();

  if (!claims) {
    throw new ApplicationError(502, "身份服务未返回有效的 ID 令牌");
  }

  return claims;
}

const readTokens = (encrypted: string) =>
  persistedTokens.parse(JSON.parse(decrypt(encrypted)));

function sessionValues(tokens: OidcTokens, previous?: Tokens) {
  const now = Date.now();
  const refreshToken = tokens.refresh_token ?? previous?.refreshToken;
  const idToken = tokens.id_token ?? previous?.idToken;

  if (!refreshToken) {
    throw new ApplicationError(502, "身份服务未返回刷新令牌");
  }
  if (!idToken) {
    throw new ApplicationError(502, "身份服务未返回 ID 令牌");
  }
  if (tokens.expires_in === undefined) {
    throw new ApplicationError(502, "身份服务未返回有效的令牌有效期");
  }

  return {
    encryptedTokens: encrypt(
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken,
        idToken,
      }),
    ),
    refreshAt: new Date(now + Math.max(1, tokens.expires_in - 30) * 1000),
    expiresAt: new Date(now + sessionRetention),
  };
}

export async function createSession(
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  user: oidc.UserInfoResponse,
  previous?: string,
) {
  const claims = idTokenClaims(tokens);
  const preferredUsername = user.preferred_username?.trim();
  const preferredName = user.name?.trim();
  const username = preferredUsername?.length ? preferredUsername : user.sub;
  const profile = {
    subject: user.sub,
    username,
    displayName: preferredName?.length ? preferredName : username,
    email: user.email,
    oidcSid: typeof claims.sid === "string" ? claims.sid : null,
  };
  const values = sessionValues(tokens);
  const token = randomToken();
  const sidMatch = profile.oidcSid
    ? eq(logoutTokens.oidcSid, profile.oidcSid)
    : undefined;

  await db.transaction(
    async (tx) => {
      const [revoked] = await tx
        .select({ jti: logoutTokens.jti })
        .from(logoutTokens)
        .where(
          and(
            gt(logoutTokens.expiresAt, new Date()),
            or(
              sidMatch,
              and(
                isNull(logoutTokens.oidcSid),
                eq(logoutTokens.subject, profile.subject),
                gte(logoutTokens.issuedAt, new Date(claims.iat * 1000)),
              ),
            ),
          ),
        )
        .limit(1);
      if (revoked) {
        throw new ApplicationError(401, "该登录已注销，请重新登录");
      }

      if (previous) {
        await tx
          .delete(sessions)
          .where(eq(sessions.tokenHash, tokenHash(previous)));
      }

      await tx.insert(sessions).values({
        ...profile,
        ...values,
        tokenHash: tokenHash(token),
      });
    },
    { isolationLevel: "serializable" },
  );

  return { token, expiresAt: values.expiresAt };
}

export async function readSession(token: string) {
  const hash = tokenHash(token);
  let session = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, hash),
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hash));

    return null;
  }

  if (session.refreshAt.getTime() <= Date.now()) {
    session = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, hash))
        .for("update");
      if (!current || current.refreshAt.getTime() > Date.now()) {
        return current;
      }

      const previousTokens = readTokens(current.encryptedTokens);

      let tokens: Awaited<ReturnType<typeof oidc.refreshTokenGrant>>;
      try {
        tokens = await oidc.refreshTokenGrant(
          await identityClient(),
          previousTokens.refreshToken,
        );
      } catch (error) {
        if (
          error instanceof oidc.ResponseBodyError &&
          error.error === "invalid_grant"
        ) {
          await tx.delete(sessions).where(eq(sessions.tokenHash, hash));

          return;
        }

        throw error;
      }

      const claims = idTokenClaims(tokens);
      if (claims.sub !== current.subject) {
        await tx.delete(sessions).where(eq(sessions.tokenHash, hash));

        return;
      }

      const [updated] = await tx
        .update(sessions)
        .set(sessionValues(tokens, previousTokens))
        .where(eq(sessions.tokenHash, hash))
        .returning();

      return updated;
    });
  }

  if (!session) {
    return null;
  }

  const { accessToken, idToken } = readTokens(session.encryptedTokens);

  return {
    ...pick(session, [
      "subject",
      "username",
      "displayName",
      "email",
      "expiresAt",
    ]),
    accessToken,
    idToken,
  };
}

export async function updateSessionProfile(
  tx: DatabaseTransaction,
  user: User,
) {
  await tx
    .update(sessions)
    .set({
      username: user.username,
      displayName: user.name,
      email: user.email,
    })
    .where(eq(sessions.subject, user.id));
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
}

export async function revokeAccountSessions(subject: string, ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  await db.transaction(
    async (tx) => {
      await tx.insert(logoutTokens).values(
        ids.map((oidcSid) => ({
          jti: randomToken(),
          subject,
          oidcSid,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + logoutRetention * 1000),
        })),
      );

      await tx
        .delete(sessions)
        .where(
          and(eq(sessions.subject, subject), inArray(sessions.oidcSid, ids)),
        );
    },
    { isolationLevel: "serializable" },
  );
}

export async function revokeSessions(token: {
  jti: string;
  subject?: string;
  oidcSid?: string;
  issuedAt: Date;
}) {
  await db.transaction(
    async (tx) => {
      const inserted = await tx
        .insert(logoutTokens)
        .values({
          jti: token.jti,
          subject: token.subject ?? null,
          oidcSid: token.oidcSid ?? null,
          issuedAt: token.issuedAt,
          expiresAt: new Date(Date.now() + logoutRetention * 1000),
        })
        .onConflictDoNothing()
        .returning({ jti: logoutTokens.jti });
      if (inserted.length === 0) {
        return;
      }

      await tx
        .delete(sessions)
        .where(
          and(
            token.subject ? eq(sessions.subject, token.subject) : undefined,
            token.oidcSid ? eq(sessions.oidcSid, token.oidcSid) : undefined,
          ),
        );
    },
    { isolationLevel: "serializable" },
  );
}

export async function cleanupExpiredSessions() {
  const now = new Date();

  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(logoutTokens).where(lt(logoutTokens.expiresAt, now));
}
