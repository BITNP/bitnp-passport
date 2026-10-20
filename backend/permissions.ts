import { eq } from "drizzle-orm";

import { managedGroups as groupConfigurations } from "#database/schema";
import type { Department } from "#shared/identity";
import { departments, systemAdministratorRole } from "#shared/identity";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { effectiveUserRoles } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import type { OrganizationGroup } from "./organization.ts";
import { organizationGroups, organizationState } from "./organization.ts";

async function accessRoles(subject: string) {
  const [user, roles] = await Promise.all([
    keycloak.user(subject),
    effectiveUserRoles(subject),
  ]);

  return user.enabled
    ? new Set(roles.map((role) => role.name!))
    : new Set<string>();
}

export const isAdministrator = async (actor: Actor) =>
  (await accessRoles(actor.subject)).has(systemAdministratorRole);

export async function requireAdministrator(actor: Actor) {
  if (!(await isAdministrator(actor))) {
    throw new ApplicationError(403, "此操作需要系统管理员权限");
  }
}

const managedDepartments = (roles: Set<string>) =>
  (Object.keys(departments) as Department[]).filter((department) =>
    roles.has(`permission-${department}-admin`),
  );

async function groupsForRoles(roles: Set<string>) {
  const administrator = roles.has(systemAdministratorRole);
  const departments = managedDepartments(roles);
  if (!administrator && departments.length === 0) {
    return [];
  }

  const [tree, configurations] = await Promise.all([
    keycloak.groupTree(),
    db
      .select()
      .from(groupConfigurations)
      .where(eq(groupConfigurations.enrolled, true)),
  ]);
  const organization = organizationGroups(tree);
  const rootId = administrator
    ? undefined
    : (await organizationState(organization)).activeRoots[0]!.id;
  const groups: {
    group: OrganizationGroup;
    configuration: typeof groupConfigurations.$inferSelect;
  }[] = [];

  for (const configuration of configurations) {
    const group = organization.get(configuration.groupId)!;
    if (group.isRoot) {
      continue;
    }

    if (
      !administrator &&
      (group.rootId !== rootId ||
        group.department === null ||
        !departments.includes(group.department))
    ) {
      continue;
    }

    groups.push({ group, configuration });
  }

  return groups;
}

export async function groupAccess(actor: Actor) {
  const roles = await accessRoles(actor.subject);

  if (roles.has(systemAdministratorRole)) {
    return { administrator: true, groupIds: [] as string[] };
  }

  const groups = await groupsForRoles(roles);

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
  const groups = await groupsForRoles(await accessRoles(actor.subject));

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
