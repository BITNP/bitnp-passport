import { userIdentity } from "#backend/identity";
import * as keycloak from "#backend/keycloak";
import { requireManagement } from "#backend/permissions";
import { systemAdministratorRole } from "#shared/identity";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const roles = await requireManagement(actor);
  const subject = getRouterParam(event, "id")!;

  if (roles.has(systemAdministratorRole)) {
    const { user, ...administration } = await userIdentity(subject);

    return { user, administration };
  }

  const { user } = await keycloak.userDetails(subject);

  return { user, administration: null };
});
