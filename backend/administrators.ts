import { systemAdministratorRole } from "#shared/identity";
import type { Actor } from "#shared/types";

import { ApplicationError } from "./errors.ts";
import { groupLabels } from "./groups/labels.ts";
import { describeRoleSources } from "./identity.ts";
import { effectiveRealmRoleHolders } from "./keycloak/roles.ts";
import { requireAdministrator } from "./permissions.ts";

interface PermissionChangePreview {
  user: { enabled: boolean; serviceAccount: boolean };
  after: readonly { name: string }[];
}

const hasSystemAdministrator = (permissions: readonly { name: string }[]) =>
  permissions.some((permission) => permission.name === systemAdministratorRole);

export const availableSystemAdministrators = async () =>
  (await effectiveRealmRoleHolders(systemAdministratorRole)).filter(
    ({ user }) => user.enabled && !user.serviceAccount,
  );

export function assertAvailableSystemAdministrator(
  previews: readonly PermissionChangePreview[],
  message: string,
) {
  if (
    !previews.some(
      ({ user, after }) =>
        user.enabled && !user.serviceAccount && hasSystemAdministrator(after),
    )
  ) {
    throw new ApplicationError(409, message);
  }
}

export async function administrators(actor: Actor) {
  await requireAdministrator(actor);
  const [holders, labels] = await Promise.all([
    effectiveRealmRoleHolders(systemAdministratorRole),
    groupLabels(),
  ]);

  return holders.map(({ user, sources }) => ({
    user,
    sources: describeRoleSources(sources, labels),
  }));
}
