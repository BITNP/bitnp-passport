import { systemAdministratorRole } from "#shared/identity";
import type { Actor } from "#shared/types";

import { groupLabels } from "./groups/labels.ts";
import { describeRoleSources } from "./identity.ts";
import {
  RoleGraph,
  effectiveRoleHolders,
  userRoleAssignments,
} from "./keycloak/roles.ts";
import { requireAdministrator } from "./permissions.ts";

export async function administrators(actor: Actor) {
  await requireAdministrator(actor);
  const [holders, labels] = await Promise.all([
    effectiveRoleHolders(systemAdministratorRole),
    groupLabels(),
  ]);
  const graph = new RoleGraph();

  return Promise.all(
    holders.map(async (user) => ({
      id: user.id!,
      username: user.username!,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      enabled: user.enabled,
      sources: describeRoleSources(
        (await userRoleAssignments(user.id!, graph)).sources.filter((source) =>
          source.roles.includes(systemAdministratorRole),
        ),
        labels,
      ),
    })),
  );
}
