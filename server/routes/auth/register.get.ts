import { configuration } from "#backend/config";
import { ApplicationError } from "#backend/errors";

export default defineEventHandler(async (event) => {
  const config = configuration();
  if (!config.registration) {
    throw new ApplicationError(403, "暂未开放注册");
  }

  const url = await beginAuthorization(event, getQuery(event).returnTo);
  url.pathname = `${new URL(config.issuer).pathname}/protocol/openid-connect/registrations`;

  return sendRedirect(event, url.href, 302);
});
