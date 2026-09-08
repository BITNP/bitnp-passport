import * as oidc from "openid-client";

import { config } from "#backend/config";
import { ApplicationError } from "#backend/errors";

export default defineEventHandler(async (event) => {
  const attempt = await consumeAuthorization(event);
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

  return sendRedirect(event, attempt.returnTo, 303);
});
