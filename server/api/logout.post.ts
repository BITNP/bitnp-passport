import * as oidc from "openid-client";

import { config } from "#backend/config";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  const url = oidc.buildEndSessionUrl(await identityClient(), {
    id_token_hint: session.idToken,
    client_id: config.clientId,
    post_logout_redirect_uri: config.appUrl,
  });

  await deletePortalSession(event);

  return { url: url.href };
});
