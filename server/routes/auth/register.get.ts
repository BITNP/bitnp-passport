import { config } from "#backend/config";

export default defineEventHandler(async (event) => {
  const url = await beginAuthorization(event, getQuery(event).returnTo);
  url.pathname = `${new URL(config.issuer).pathname}/protocol/openid-connect/registrations`;

  return sendRedirect(event, url.href, 302);
});
