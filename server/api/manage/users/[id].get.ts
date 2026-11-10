import { userDetails } from "#backend/keycloak";
import { requireManagement } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  await requireManagement(await requireSession(event));
  const { user } = await userDetails(routeParam(event, "id"));

  return user;
});
