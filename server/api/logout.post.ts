import * as oidc from "openid-client";

import { configuration } from "#backend/config";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const config = configuration();

  await deletePortalSession(event, session.tokenHash);

  try {
    return {
      url: oidc.buildEndSessionUrl(await identityClient(), {
        id_token_hint: session.idToken,
        client_id: config.clientId,
        post_logout_redirect_uri: config.appUrl,
      }).href,
    };
  } catch {
    return { url: `${config.appUrl}/?logout=local` };
  }
});
