import { and, eq, inArray, or } from "drizzle-orm";

import {
  groupDelegations,
  managedGroups as groups,
  portalAdmins,
} from "#database/schema";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";

export async function isAdministrator(actor: Actor) {
  const administrator = await db.query.portalAdmins.findFirst({
    columns: { subject: true },
    where: eq(portalAdmins.subject, actor.subject),
  });

  return administrator !== undefined;
}

export async function requireAdministrator(actor: Actor) {
  if (!(await isAdministrator(actor))) {
    throw new ApplicationError(403, "此操作需要系统管理员权限");
  }
}

export async function groupAccess(actor: Actor) {
  if (await isAdministrator(actor)) {
    return { administrator: true, groupIds: [] };
  }

  const memberships = await keycloak.inheritedGroupIds(actor.subject);
  const delegations = await db
    .select({ groupId: groupDelegations.groupId })
    .from(groupDelegations)
    .where(
      or(
        and(
          eq(groupDelegations.type, "user"),
          eq(groupDelegations.subject, actor.subject),
        ),
        and(
          eq(groupDelegations.type, "group"),
          inArray(groupDelegations.subject, [...memberships]),
        ),
      ),
    );

  return {
    administrator: false,
    groupIds: delegations.map((delegation) => delegation.groupId),
  };
}

export async function requireGroupManager(actor: Actor, groupId: string) {
  const { administrator, groupIds } = await groupAccess(actor);
  const [group] = await db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.groupId, groupId),
        administrator ? undefined : inArray(groups.groupId, groupIds),
      ),
    )
    .limit(1);

  if (!group) {
    throw new ApplicationError(403, "你没有管理此组的权限");
  }

  return group;
}

export async function managedGroups(actor: Actor) {
  const { administrator, groupIds } = await groupAccess(actor);

  return db
    .select()
    .from(groups)
    .where(administrator ? undefined : inArray(groups.groupId, groupIds))
    .orderBy(groups.label, groups.groupId);
}
