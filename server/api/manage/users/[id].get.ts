import * as keycloak from "#backend/keycloak";
import { requireManagement } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  await requireManagement(actor);

  const { user } = await keycloak.userDetails(getRouterParam(event, "id")!);

  return user;
});
