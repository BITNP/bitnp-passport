import { config } from "#backend/config";

export default defineEventHandler(async (event) => {
  const url = await beginAuthorization(event, "/account/security");
  url.pathname = `${new URL(config.issuer).pathname}/protocol/openid-connect/forgot-credentials`;

  return sendRedirect(event, url.href, 302);
});
