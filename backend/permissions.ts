import { eq } from "drizzle-orm";

import { managedGroups as groupConfigurations } from "#database/schema";
import {
  managedDepartmentCodes,
  systemAdministratorRole,
} from "#shared/identity";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { effectiveUserRoles } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import type { OrganizationGroup } from "./organization.ts";
import { mapOrganizationGroups, organizationState } from "./organization.ts";

interface GroupAccess {
  administrator: boolean;
  groupIds: string[];
}

const missingActiveRootMessage =
  "未识别到当前届组织；请联系系统管理员确认届别根组配置了当前组织标记";

export async function userAccess(subject: string) {
  const [user, roles] = await Promise.all([
    keycloak.user(subject),
    effectiveUserRoles(subject),
  ]);
  const effective = user.enabled
    ? new Set(roles.map((role) => role.name))
    : new Set<string>();

  return {
    user,
    roles: effective,
    management: managedDepartmentCodes(effective).length > 0,
  };
}

export async function requireAdministrator(actor: Actor) {
  const { roles } = await userAccess(actor.subject);

  if (!roles.has(systemAdministratorRole)) {
    throw new ApplicationError(403, "此操作需要系统管理员权限");
  }
}

export async function requireManagement(actor: Actor) {
  const access = await userAccess(actor.subject);

  if (!access.management) {
    throw new ApplicationError(403, "此操作需要管理层权限");
  }

  return access;
}

async function groupsManagedByRoles(roles: Set<string>) {
  const administrator = roles.has(systemAdministratorRole);
  const managed = managedDepartmentCodes(roles);
  const [tree, configurations] = await Promise.all([
    keycloak.groupTree(),
    db
      .select()
      .from(groupConfigurations)
      .where(eq(groupConfigurations.enrolled, true)),
  ]);
  const organization = mapOrganizationGroups(tree);
  const activeRoot = administrator
    ? null
    : (await organizationState(organization)).activeRoot;

  if (!administrator && activeRoot === null) {
    throw new ApplicationError(409, missingActiveRootMessage);
  }

  const rootId = activeRoot?.id;
  const groups: {
    group: OrganizationGroup;
    configuration: typeof groupConfigurations.$inferSelect;
  }[] = [];

  for (const configuration of configurations) {
    const group = organization.get(configuration.groupId);
    if (!group || group.isRoot) {
      continue;
    }

    if (
      !administrator &&
      (group.rootId !== rootId ||
        group.department === null ||
        !managed.includes(group.department))
    ) {
      continue;
    }

    groups.push({ group, configuration });
  }

  return groups;
}

export async function groupAccess(actor: Actor): Promise<GroupAccess> {
  const { roles } = await requireManagement(actor);

  if (roles.has(systemAdministratorRole)) {
    return { administrator: true, groupIds: [] };
  }

  const groups = await groupsManagedByRoles(roles);

  return {
    administrator: false,
    groupIds: groups.map(({ group }) => group.id),
  };
}

export async function requireGroupManager(actor: Actor, groupId: string) {
  const { administrator, groupIds } = await groupAccess(actor);

  if (!administrator && !groupIds.includes(groupId)) {
    throw new ApplicationError(403, "你没有管理此组的权限");
  }
}

export async function managedGroups(actor: Actor) {
  const { roles } = await requireManagement(actor);
  const groups = await groupsManagedByRoles(roles);

  return groups
    .sort(
      (left, right) =>
        (right.group.year ?? 0) - (left.group.year ?? 0) ||
        left.configuration.label.localeCompare(right.configuration.label),
    )
    .map(({ group, configuration }) => ({
      groupId: group.id,
      label: configuration.label,
      path: group.path,
      note: configuration.note,
      allowInvites: configuration.allowInvites,
    }));
}
