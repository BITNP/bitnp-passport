import { and, eq, inArray, or } from "drizzle-orm";

import { groupDelegations, portalAdmins } from "#database/schema";
import type { Actor } from "#shared/types";

import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { groupDirectory } from "./groups/directory.ts";
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
  const [administrator, memberships, directory] = await Promise.all([
    isAdministrator({ subject }),
    keycloak.groupsForUser(subject),
    groupDirectory(),
  ]);
  const inherited = await keycloak.inheritedGroups(memberships);
  const membershipDetails = new Map(
    inherited.map((group) => [
      group.id,
      {
        id: group.id,
        label: directory.get(group.id)?.label ?? group.name,
        path: group.path,
      },
    ]),
  );
  const [delegations, activeSources] = await Promise.all([
    delegationsFor(subject, [...membershipDetails.keys()]),
    keycloak.activeMemberSources(subject, inherited),
  ]);

  return {
    administrator,
    memberships: memberships.map((group) => membershipDetails.get(group.id)!),
    groups: [...directory.values()].flatMap((group) => {
      const sources = delegations
        .filter((delegation) => delegation.groupId === group.id)
        .map((delegation) =>
          delegation.type === "user"
            ? null
            : membershipDetails.get(delegation.subject)!,
        );

      return sources.length > 0
        ? [{ groupId: group.id, label: group.label, sources }]
        : [];
    }),
    activeSources: activeSources.map((source) => ({
      group:
        source.groupId === null ? null : membershipDetails.get(source.groupId)!,
      role: source.role,
    })),
  };
}

export async function requireGroupManager(actor: Actor, groupId: string) {
  const { administrator, groupIds } = await groupAccess(actor);
  if (!administrator && !groupIds.includes(groupId)) {
    throw new ApplicationError(403, "你没有管理此组的权限");
  }
}

export async function managedGroups(actor: Actor) {
  const { administrator, groupIds } = await groupAccess(actor);

  const directory = await groupDirectory();

  return [...directory.values()]
    .filter((group) => administrator || groupIds.includes(group.id))
    .sort(
      (left, right) =>
        (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0) ||
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id),
    )
    .map((group) => ({
      groupId: group.id,
      configured: group.configured,
      label: group.label,
      path: group.path,
      note: group.note,
      allowInvites: group.allowInvites,
    }));
}
