import {
  activeOrganizationRole,
  departments,
  isCurrentPositionRole,
  managedDepartmentCodes,
  roleLabel,
  roleSourceLabel,
  systemAdministratorRole,
} from "#shared/identity";

import { groupLabels } from "./groups/labels.ts";
import type { RoleSource } from "./keycloak/roles.ts";
import { userRoleAssignments } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { pick } from "./utils.ts";

export const describeRoleSources = (
  sources: readonly RoleSource[],
  labels: ReadonlyMap<string, string>,
) =>
  sources.map((source) => ({
    group: source.group
      ? {
          id: source.group.id,
          label: labels.get(source.group.id) ?? source.group.name,
          path: source.group.path,
        }
      : null,
    role: source.role,
    label: roleSourceLabel(source.role, source.group?.id ?? null),
  }));

export async function userIdentity(subject: string) {
  const [{ user, attributes }, assignments, labels] = await Promise.all([
    keycloak.userDetails(subject),
    userRoleAssignments(subject),
    groupLabels(),
  ]);

  const groupInfo = (group: { id: string; name: string; path: string }) => ({
    id: group.id,
    label: labels.get(group.id) ?? group.name,
    path: group.path,
  });

  const origins = (name: string) =>
    describeRoleSources(
      assignments.sources.filter((source) => source.roles.includes(name)),
      labels,
    );

  const effective = new Set(
    assignments.effectiveRoles.map((role) => role.name),
  );
  const describe = (name: string) => ({
    name,
    label: roleLabel(name),
    sources: origins(name),
  });

  return {
    user,
    attributes,
    roles: assignments.effectiveRoles.map((role) => pick(role, ["id", "name"])),
    directRoles: assignments.directRoles.map((role) => role.name),
    permissions: {
      enabled: user.enabled,
      active: user.enabled && effective.has(activeOrganizationRole),
      activeSources: origins(activeOrganizationRole),
      administrator: user.enabled && effective.has(systemAdministratorRole),
      memberships: assignments.memberships.map(groupInfo),
      positions: [...effective]
        .filter(isCurrentPositionRole)
        .sort()
        .map(describe),
      permissions: [...effective]
        .filter((name) => name.startsWith("permission-"))
        .sort()
        .map(describe),
      managedDepartments: user.enabled
        ? managedDepartmentCodes(effective).map((code) => ({
            code,
            label: departments[code],
          }))
        : [],
    },
  };
}
