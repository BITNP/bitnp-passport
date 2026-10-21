import { avatarUrlFromAttributes } from "#shared/avatar";
import {
  departmentCodes,
  departments,
  roleLabel,
  systemAdministratorRole,
} from "#shared/identity";

import { groupLabels } from "./groups/labels.ts";
import { userRoleAssignments } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { pick } from "./utils.ts";

type RoleSource = Awaited<
  ReturnType<typeof userRoleAssignments>
>["sources"][number];

export const describeRoleSources = (
  sources: RoleSource[],
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
    label: roleLabel(source.role),
  }));

export async function userIdentity(subject: string) {
  const [user, assignments, labels] = await Promise.all([
    keycloak.user(subject),
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

  const effective = assignments.effectiveRoles.map((role) => role.name!);
  const describe = (name: string) => ({
    name,
    label: roleLabel(name),
    sources: origins(name),
  });

  return {
    user,
    avatarUrl: avatarUrlFromAttributes(user.attributes),
    roles: assignments.effectiveRoles.map((role) => pick(role, ["id", "name"])),
    directRoles: assignments.directRoles.map((role) => role.name!),
    permissions: {
      enabled: user.enabled,
      administrator:
        user.enabled && effective.includes(systemAdministratorRole),
      memberships: assignments.memberships.map(groupInfo),
      positions: effective
        .filter((name) => name.startsWith("position-"))
        .sort()
        .map(describe),
      permissions: effective
        .filter((name) => name.startsWith("permission-"))
        .sort()
        .map(describe),
      managedDepartments: user.enabled
        ? departmentCodes
            .filter(
              (code) =>
                effective.includes(systemAdministratorRole) ||
                effective.includes(`permission-${code}-admin`),
            )
            .map((code) => ({ code, label: departments[code] }))
        : [],
    },
  };
}
