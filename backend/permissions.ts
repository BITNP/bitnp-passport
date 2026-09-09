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

const delegationsFor = (subject: string, groupIds: string[]) =>
  db
    .select({
      groupId: groupDelegations.groupId,
      type: groupDelegations.type,
      subject: groupDelegations.subject,
    })
    .from(groupDelegations)
    .where(
      or(
        and(
          eq(groupDelegations.type, "user"),
          eq(groupDelegations.subject, subject),
        ),
        and(
          eq(groupDelegations.type, "group"),
          inArray(groupDelegations.subject, groupIds),
        ),
      ),
    )
    .orderBy(groupDelegations.createdAt);

export async function groupAccess(actor: Actor) {
  if (await isAdministrator(actor)) {
    return { administrator: true, groupIds: [] };
  }

  const memberships = await keycloak.inheritedGroups(
    await keycloak.groupsForUser(actor.subject),
  );
  const delegations = await delegationsFor(
    actor.subject,
    memberships.map((group) => group.id),
  );

  return {
    administrator: false,
    groupIds: delegations.map((delegation) => delegation.groupId),
  };
}

export async function permissionDetails(subject: string) {
  const [administrator, memberships, settings] = await Promise.all([
    isAdministrator({ subject }),
    keycloak.groupsForUser(subject),
    db
      .select({ groupId: groups.groupId, label: groups.label })
      .from(groups)
      .orderBy(groups.label, groups.groupId),
  ]);
  const inherited = await keycloak.inheritedGroups(memberships);
  const labels = new Map(settings.map((group) => [group.groupId, group.label]));
  const directory = new Map(
    inherited.map((group) => [
      group.id,
      {
        id: group.id,
        label: labels.get(group.id) ?? group.name,
        path: group.path,
        managed: labels.has(group.id),
      },
    ]),
  );
  const [delegations, activeSources] = await Promise.all([
    delegationsFor(subject, [...directory.keys()]),
    keycloak.activeMemberSources(subject, inherited),
  ]);

  return {
    administrator,
    memberships: memberships.map((group) => directory.get(group.id)!),
    groups: settings.flatMap((group) => {
      const sources = delegations
        .filter((delegation) => delegation.groupId === group.groupId)
        .map((delegation) =>
          delegation.type === "user"
            ? null
            : directory.get(delegation.subject)!,
        );

      return sources.length > 0 ? [{ ...group, sources }] : [];
    }),
    activeSources: activeSources.map((source) => ({
      group: source.groupId === null ? null : directory.get(source.groupId)!,
      role: source.role,
    })),
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
