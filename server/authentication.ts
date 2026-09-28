import type { H3Event, SessionConfig } from "h3";
import * as oidc from "openid-client";

import { config } from "#backend/config";
import { ApplicationError } from "#backend/errors";
import { authorizeInvitation, joinInvitation } from "#backend/invitations";

import { identityClient } from "./oidc";

type AuthenticationRequest =
  | { type: "login" | "register"; returnTo: unknown }
  | { type: "reset-password" }
  | {
      type: "account-action";
      action: string;
      user: { subject: string; username: string };
    }
  | { type: "invitation"; token: string; mode: "login" | "register" };

interface LoginSession {
  attempt?: {
    state: string;
    nonce: string;
    verifier: string;
    subject?: string;
    returnTo: string;
    invitationToken?: string;
  };
}

const loginConfig = {
  name: `${config.secureCookies ? "__Host-" : ""}bitnp-login`,
  password: config.encryptionKey.toString("base64"),
  maxAge: 10 * 60,
  sessionHeader: false,
  cookie: { secure: config.secureCookies, sameSite: "lax" },
} satisfies SessionConfig;

export function returnUrl(input: unknown) {
  const url = URL.parse(
    typeof input === "string" ? input : "/account",
    config.appUrl,
  );

  return url?.origin === config.appUrl ? url.href : "/account";
}

export async function beginAuthentication(
  event: H3Event,
  request: AuthenticationRequest,
) {
  let returnTo: unknown;
  let endpoint = "auth";

  switch (request.type) {
    case "login":
    case "register": {
      returnTo = request.returnTo;
      endpoint = request.type === "register" ? "registrations" : "auth";

      break;
    }
    case "reset-password": {
      returnTo = "/account/security";
      endpoint = "forgot-credentials";

      break;
    }
    case "account-action": {
      returnTo = "/account/security?returned=1";

      break;
    }
    case "invitation": {
      await authorizeInvitation(request.token, request.mode);
      returnTo = `/i/${encodeURIComponent(request.token)}`;
      endpoint = request.mode === "register" ? "registrations" : "auth";

      break;
    }
  }

  const client = await identityClient();
  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const url = oidc.buildAuthorizationUrl(client, {
    redirect_uri: `${config.appUrl}/auth/callback`,
    scope: "openid profile email",
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
    ...(request.type === "account-action" && {
      kc_action: request.action,
      login_hint: request.user.username,
    }),
  });
  if (endpoint !== "auth") {
    url.pathname = `${new URL(config.issuer).pathname}/protocol/openid-connect/${endpoint}`;
  }

  const login = await getSession<LoginSession>(event, loginConfig);
  login.createdAt = Date.now();
  await updateSession<LoginSession>(event, loginConfig, {
    attempt: {
      state,
      nonce,
      verifier,
      returnTo: returnUrl(returnTo),
      subject:
        request.type === "account-action" ? request.user.subject : undefined,
      invitationToken:
        request.type === "invitation" ? request.token : undefined,
    },
  });

  return url;
}

export async function completeAuthentication(event: H3Event) {
  const { data } = await getSession<LoginSession>(event, loginConfig);
  await clearSession(event, loginConfig);
  const { attempt } = data;
  if (!attempt) {
    throw new ApplicationError(400, "登录请求已失效，请重新登录");
  }

  const callback = new URL(`${config.appUrl}/auth/callback`);
  callback.search = getRequestURL(event).search;
  const client = await identityClient();
  const tokens = await oidc.authorizationCodeGrant(client, callback, {
    pkceCodeVerifier: attempt.verifier,
    expectedState: attempt.state,
    expectedNonce: attempt.nonce,
  });

  // expectedNonce makes openid-client require and validate an ID token.
  const claims = tokens.claims()!;
  if (attempt.subject && claims.sub !== attempt.subject) {
    throw new ApplicationError(
      403,
      "安全设置过程中登录账户发生变化，请使用原账户重新操作",
    );
  }

  const profile = await oidc.fetchUserInfo(
    client,
    tokens.access_token,
    claims.sub,
  );
  await createPortalSession(event, tokens, profile);

  if (attempt.invitationToken) {
    try {
      await joinInvitation({ subject: claims.sub }, attempt.invitationToken);
    } catch {
      // A failed join must not undo a successful login; the invitation page offers a retry.
      return `${attempt.returnTo}?join=failed`;
    }
  }

  return attempt.returnTo;
}
