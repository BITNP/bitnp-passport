import { and, eq, gt, gte, inArray, isNull, lt, or } from "drizzle-orm";
import * as oidc from "openid-client";

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

const sessionRetention = 14 * 24 * 60 * 60 * 1000;

const logoutRetention = 12 * 60 * 60;

function sessionValues(tokens: oidc.TokenEndpointResponse) {
  const now = Date.now();

  return {
    encryptedTokens: encrypt(
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
      }),
    ),
    refreshAt: new Date(now + Math.max(1, tokens.expires_in! - 30) * 1000),
    expiresAt: new Date(now + sessionRetention),
  };
}

export async function createSession(
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  user: oidc.UserInfoResponse,
  previous?: string,
) {
  const claims = tokens.claims()!;
  const profile = {
    subject: user.sub,
    username: user.preferred_username!,
    displayName: user.name ?? user.preferred_username!,
    email: user.email,
    oidcSid: claims.sid as string,
  };
  const values = sessionValues(tokens);
  const token = randomToken();

  await db.transaction(
    async (tx) => {
      const [revoked] = await tx
        .select({ jti: logoutTokens.jti })
        .from(logoutTokens)
        .where(
          and(
            gt(logoutTokens.expiresAt, new Date()),
            or(
              eq(logoutTokens.oidcSid, profile.oidcSid),
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

  if (session && session.refreshAt.getTime() <= Date.now()) {
    session = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, hash))
        .for("update");
      if (!current || current.refreshAt.getTime() > Date.now()) {
        return current;
      }

      const { refreshToken } = JSON.parse(
        decrypt(current.encryptedTokens),
      ) as Tokens;

      let tokens: Awaited<ReturnType<typeof oidc.refreshTokenGrant>>;
      try {
        tokens = await oidc.refreshTokenGrant(
          await identityClient(),
          refreshToken,
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

      const claims = tokens.claims()!;
      if (claims.sub !== current.subject) {
        await tx.delete(sessions).where(eq(sessions.tokenHash, hash));

        return;
      }

      const [updated] = await tx
        .update(sessions)
        .set(sessionValues(tokens))
        .where(eq(sessions.tokenHash, hash))
        .returning();

      return updated;
    });
  }

  if (!session) {
    return null;
  }

  const { accessToken, idToken } = JSON.parse(
    decrypt(session.encryptedTokens),
  ) as Tokens;

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
      displayName: user.name || user.username,
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
  subject: string;
  oidcSid?: string;
  issuedAt: Date;
}) {
  await db.transaction(
    async (tx) => {
      const inserted = await tx
        .insert(logoutTokens)
        .values({
          ...token,
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
            token.oidcSid ? eq(sessions.oidcSid, token.oidcSid) : undefined,
            eq(sessions.subject, token.subject),
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
