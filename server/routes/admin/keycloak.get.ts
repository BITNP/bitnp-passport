import { consoleUrl } from "#backend/keycloak";
import { requireAdministrator } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  await requireAdministrator(await requireSession(event));

  return sendRedirect(event, consoleUrl, 302);
});
