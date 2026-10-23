import { systemAdministratorRole } from "#shared/identity";
import type { Actor } from "#shared/types";

import { groupLabels } from "./groups/labels.ts";
import { describeRoleSources } from "./identity.ts";
import { effectiveRoleHolders } from "./keycloak/roles.ts";
import { requireAdministrator } from "./permissions.ts";

export async function administrators(actor: Actor) {
  await requireAdministrator(actor);
  const [holders, labels] = await Promise.all([
    effectiveRoleHolders(systemAdministratorRole),
    groupLabels(),
  ]);

  return holders.map(({ user, sources }) => ({
    user,
    sources: describeRoleSources(sources, labels),
  }));
}
