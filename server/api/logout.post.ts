import * as oidc from "openid-client";

import { config } from "#backend/config";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const returnTo = getQuery(event).returnTo;

  const url = oidc.buildEndSessionUrl(await identityClient(), {
    id_token_hint: session.idToken,
    client_id: config.clientId,
  });
  url.searchParams.set(
    config.keycloakVersion === "9"
      ? "redirect_uri"
      : "post_logout_redirect_uri",
    returnTo ? returnUrl(returnTo) : config.appUrl,
  );

  await deletePortalSession(event);

  return { url: url.href };
});
