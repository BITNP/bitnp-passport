import { managedGroups } from "#database/schema";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import * as keycloak from "./keycloak.ts";
import { groupAccess, requireAdministrator } from "./permissions.ts";

export async function listUsers(actor: Actor, search: string, first: number) {
  await requireAdministrator(actor);

  return keycloak.searchUsers(search, first);
}

export async function userDetail(actor: Actor, id: string) {
  await requireAdministrator(actor);

  const [user, groups, roles, access, configuredGroups] = await Promise.all([
    keycloak.user(id),
    keycloak.groupsForUser(id),
    keycloak.userRoles(id),
    groupAccess({ subject: id }),
    db
      .select({ groupId: managedGroups.groupId, label: managedGroups.label })
      .from(managedGroups)
      .orderBy(managedGroups.label, managedGroups.groupId),
  ]);
  const labels = new Map(
    configuredGroups.map((group) => [group.groupId, group.label]),
  );

  return {
    user,
    groups: groups.map((group) => ({
      id: group.id,
      path: group.path,
      label: labels.get(group.id) ?? group.name,
      managed: labels.has(group.id),
    })),
    roles,
    permissions: {
      administrator: access.administrator,
      groups: configuredGroups.filter((group) =>
        access.groupIds.includes(group.groupId),
      ),
    },
  };
}
