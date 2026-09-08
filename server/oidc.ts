import type { H3Event, SessionConfig } from "h3";
import * as oidc from "openid-client";

import { config } from "#backend/config";
import { ApplicationError } from "#backend/errors";
import { createSharedAsync } from "#backend/utils";

interface LoginSession {
  attempt?: {
    state: string;
    nonce: string;
    verifier: string;
    subject?: string;
    returnTo: string;
  };
}

const loginConfig = {
  name: `${config.secureCookies ? "__Host-" : ""}bitnp-login`,
  password: config.encryptionKey.toString("base64"),
  maxAge: 10 * 60,
  sessionHeader: false,
  cookie: {
    secure: config.secureCookies,
    sameSite: "lax",
  },
} satisfies SessionConfig;

export const identityClient = createSharedAsync(() =>
  oidc.discovery(
    new URL(config.issuer),
    config.clientId,
    config.clientSecret,
    undefined,
    {
      timeout: 10,
      // For local development
      execute: config.issuer.startsWith("http:")
        ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks]
        : [oidc.enableNonRepudiationChecks],
    },
  ),
);

export function returnUrl(input: unknown) {
  const url = URL.parse(
    typeof input === "string" ? input : "/account",
    config.appUrl,
  );

  return url?.origin === config.appUrl ? url.href : "/account";
}

export async function beginAuthorization(
  event: H3Event,
  returnTo: unknown,
  accountAction?: { action: string; subject: string; username: string },
) {
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
    ...(accountAction && {
      kc_action: accountAction.action,
      login_hint: accountAction.username,
    }),
  });

  const login = await getSession<LoginSession>(event, loginConfig);
  login.createdAt = Date.now();

  await updateSession<LoginSession>(event, loginConfig, {
    attempt: {
      state,
      nonce,
      verifier,
      subject: accountAction?.subject,
      returnTo: returnUrl(returnTo),
    },
  });

  return url;
}

export async function beginAccountAction(
  event: H3Event,
  session: { subject: string; username: string },
  action: string,
) {
  const url = await beginAuthorization(event, "/account/security?returned=1", {
    action,
    subject: session.subject,
    username: session.username,
  });

  return url.href;
}

export async function consumeAuthorization(event: H3Event) {
  const { data } = await getSession<LoginSession>(event, loginConfig);
  await clearSession(event, loginConfig);

  const { attempt } = data;
  if (!attempt) {
    throw new ApplicationError(400, "登录请求已失效，请重新登录");
  }

  return attempt;
}
