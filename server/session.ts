import { and, eq, gt, gte, inArray, isNull, or } from "drizzle-orm";
import type { H3Event } from "h3";
import * as oidc from "openid-client";

import { config } from "#backend/config";
import { decrypt, encrypt, randomToken, tokenHash } from "#backend/crypto";
import { db } from "#backend/database";
import { ApplicationError } from "#backend/errors";
import { pick } from "#backend/utils";
import { logoutTokens, sessions } from "#database/schema";
import type { Profile } from "#shared/types";

interface Tokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

// Keep portal sessions independently of the refresh token's reported expiry
// Keep in sync with the old implementation which is more convenient
const sessionRetention = 14 * 24 * 60 * 60 * 1000;

// Retain logout records for in-flight callbacks
const logoutRetention = 12 * 60 * 60;

const cookieName = `${config.secureCookies ? "__Host-" : ""}bitnp-session`;

const cookieOptions = {
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: "lax" as const,
  path: "/",
};

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

export async function createPortalSession(
  event: H3Event,
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  user: oidc.UserInfoResponse,
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
  const previous = getCookie(event, cookieName);

  // A logout can arrive while the callback is in flight
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

  setCookie(event, cookieName, token, {
    ...cookieOptions,
    expires: values.expiresAt,
  });
}

export async function getPortalSession(event: H3Event) {
  const token = getCookie(event, cookieName);
  if (!token) {
    return null;
  }

  const hash = tokenHash(token);
  let session = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, hash),
  });

  if (session && session.refreshAt.getTime() <= Date.now()) {
    session = await db.transaction(async (tx) => {
      // Re-read after locking: another request may have renewed or revoked it
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
    deleteCookie(event, cookieName, cookieOptions);

    return null;
  }

  setCookie(event, cookieName, token, {
    ...cookieOptions,
    expires: session.expiresAt,
  });

  const { accessToken, idToken } = JSON.parse(
    decrypt(session.encryptedTokens),
  ) as Tokens;

  return {
    ...pick(session, ["subject", "username", "displayName", "email"]),
    accessToken,
    idToken,
  };
}

export async function requireSession(event: H3Event) {
  const session = await getPortalSession(event);
  if (!session) {
    throw new ApplicationError(401, "登录已失效，请重新登录");
  }

  return session;
}

export async function updateSessionProfile(subject: string, profile: Profile) {
  await db
    .update(sessions)
    .set({
      username: profile.username,
      displayName:
        [profile.lastName, profile.firstName].join("") || profile.username,
      email: profile.email ?? null,
    })
    .where(eq(sessions.subject, subject));
}

export async function deletePortalSession(event: H3Event) {
  const hash = tokenHash(getCookie(event, cookieName)!);

  await db.delete(sessions).where(eq(sessions.tokenHash, hash));
  deleteCookie(event, cookieName, cookieOptions);
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
