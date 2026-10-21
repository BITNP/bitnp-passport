import type { H3Event } from "h3";
import type * as oidc from "openid-client";

import { config } from "#backend/config";
import { ApplicationError } from "#backend/errors";
import * as sessions from "#backend/sessions";

const cookieName = `${config.secureCookies ? "__Host-" : ""}bitnp-session`;

const cookieOptions = {
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: "lax" as const,
  path: "/",
};

export async function createPortalSession(
  event: H3Event,
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  user: oidc.UserInfoResponse,
) {
  const { token, expiresAt } = await sessions.createSession(
    tokens,
    user,
    getCookie(event, cookieName),
  );

  setCookie(event, cookieName, token, { ...cookieOptions, expires: expiresAt });
}

export async function getPortalSession(event: H3Event) {
  const token = getCookie(event, cookieName);
  if (!token) {
    return null;
  }

  const session = await sessions.readSession(token);
  if (!session) {
    deleteCookie(event, cookieName, cookieOptions);

    return null;
  }

  const { expiresAt, ...credentials } = session;
  setCookie(event, cookieName, token, { ...cookieOptions, expires: expiresAt });

  return credentials;
}

export async function requireSession(event: H3Event) {
  const session = await getPortalSession(event);
  if (!session) {
    throw new ApplicationError(401, "登录已失效，请重新登录");
  }

  return session;
}

export async function refreshPortalSession(event: H3Event) {
  const token = getCookie(event, cookieName);
  if (!token) {
    return;
  }

  const session = await sessions.refreshSession(token);
  if (!session) {
    deleteCookie(event, cookieName, cookieOptions);

    return;
  }

  setCookie(event, cookieName, token, {
    ...cookieOptions,
    expires: session.expiresAt,
  });
}

export async function deletePortalSession(event: H3Event) {
  await sessions.deleteSession(getCookie(event, cookieName)!);
  deleteCookie(event, cookieName, cookieOptions);
}
