import * as keycloak from "#backend/keycloak";
import { requireGroupManager } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const groupId = getRouterParam(event, "id")!;
  await requireGroupManager(actor, groupId);

  return keycloak.members(groupId);
});
