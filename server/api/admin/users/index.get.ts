import * as keycloak from "#backend/keycloak";
import { requireAdministrator } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  await requireAdministrator(actor);

  const { search, first } = await getValidatedQuery(event, searchQuery.parse);

  return keycloak.searchUsers(search, first);
});
