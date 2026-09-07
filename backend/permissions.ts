import { and, eq, exists, or } from "drizzle-orm";

import {
  groupDelegations,
  managedGroups as groups,
  portalAdmins,
} from "#database/schema";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";

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

const manageableBy = (actor: Actor) =>
  or(
    // 系统管理员可以管理所有组
    exists(
      db
        .select({ subject: portalAdmins.subject })
        .from(portalAdmins)
        .where(eq(portalAdmins.subject, actor.subject)),
    ),
    // 组管理员可以管理自己负责的组
    exists(
      db
        .select({ subject: groupDelegations.subject })
        .from(groupDelegations)
        .where(
          and(
            eq(groupDelegations.groupId, groups.groupId),
            eq(groupDelegations.subject, actor.subject),
          ),
        ),
    ),
  );

export async function requireGroupManager(actor: Actor, groupId: string) {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.groupId, groupId), manageableBy(actor)))
    .limit(1);

  if (!group) {
    throw new ApplicationError(403, "你没有管理此组的权限");
  }

  return group;
}

export const managedGroups = async (actor: Actor) =>
  db
    .select()
    .from(groups)
    .where(manageableBy(actor))
    .orderBy(groups.label, groups.groupId);
