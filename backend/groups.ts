import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { groupDelegations, invitations, managedGroups } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator, requireGroupManager } from "./permissions.ts";

export const groupConfiguration = z.object({
  groupId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^/\p{Cc}]+$/u),
  label: z.string().trim().min(1),
  note: z.string().trim(),
  allowInvites: z.boolean(),
});

export async function listGroups(actor: Actor) {
  await requireAdministrator(actor);

  const [groups, settings] = await Promise.all([
    keycloak.groupTree(),
    db.select().from(managedGroups),
  ]);

  return { groups, settings };
}

export async function groupDetail(actor: Actor, groupId: string) {
  const settings = await requireGroupManager(actor, groupId);

  const [directory, members, delegations] = await Promise.all([
    keycloak.group(groupId),
    keycloak.members(groupId),
    db
      .select()
      .from(groupDelegations)
      .where(eq(groupDelegations.groupId, groupId))
      .orderBy(groupDelegations.createdAt),
  ]);

  const delegates = await Promise.all(
    delegations.map(async (delegation) => {
      let name: string | null;

      try {
        if (delegation.type === "user") {
          name = (await keycloak.user(delegation.subject)).username;
        } else {
          name = (await keycloak.group(delegation.subject)).path;
        }
      } catch (error) {
        // Keep delegations visible after a 404 so they can still be revoked
        if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
          throw error;
        }

        name = null;
      }

      return { ...delegation, name };
    }),
  );

  return {
    settings,
    directory,
    members,
    delegates,
  };
}

export async function configureGroup(
  actor: Actor,
  input: z.infer<typeof groupConfiguration>,
) {
  await requireAdministrator(actor);

  const { groupId, name, ...settings } = input;
  const current = await keycloak.group(groupId);

  return audited(
    actor,
    { operation: "group.configure", groupId: input.groupId, detail: input },
    async () => {
      if (name !== current.name) {
        await keycloak.renameGroup(groupId, name);
      }

      return db.transaction(async (tx) => {
        const [group] = await tx
          .insert(managedGroups)
          .values({ groupId, ...settings, createdBy: actor.subject })
          .onConflictDoUpdate({
            target: managedGroups.groupId,
            set: settings,
          })
          .returning();

        if (!input.allowInvites) {
          await tx
            .update(invitations)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(invitations.groupId, input.groupId),
                isNull(invitations.revokedAt),
              ),
            );
        }

        return group!;
      });
    },
  );
}

export async function createGroup(
  actor: Actor,
  input: Omit<z.infer<typeof groupConfiguration>, "groupId"> & {
    parentId?: string;
  },
) {
  await requireAdministrator(actor);

  const { name, parentId, ...settings } = input;

  return audited(
    actor,
    { operation: "group.create", detail: input },
    async () => {
      const groupId = await keycloak.createGroup(name, parentId);

      const [configured] = await db
        .insert(managedGroups)
        .values({ groupId, ...settings, createdBy: actor.subject })
        .returning();

      return configured!;
    },
  );
}

export async function addMember(
  actor: Actor,
  groupId: string,
  identifier: string,
) {
  await requireGroupManager(actor, groupId);

  const user = await keycloak.resolveUser(identifier);
  if (!user.enabled) {
    throw new ApplicationError(422, "不能添加已停用的用户");
  }

  return audited(
    actor,
    {
      operation: "member.add",
      groupId,
      target: user.id,
    },
    async () => {
      await keycloak.addMember(user.id, groupId);

      return { id: user.id, username: user.username };
    },
  );
}

export async function removeMember(
  actor: Actor,
  groupId: string,
  subject: string,
) {
  await requireGroupManager(actor, groupId);

  return audited(
    actor,
    { operation: "member.remove", groupId, target: subject },
    async () => {
      await keycloak.removeMember(subject, groupId);

      return { id: subject };
    },
  );
}

async function requireDelegationManager(actor: Actor, groupId: string) {
  await requireAdministrator(actor);

  const group = await db.query.managedGroups.findFirst({
    where: eq(managedGroups.groupId, groupId),
    columns: { groupId: true },
  });
  if (!group) {
    throw new ApplicationError(404, "此群组尚未纳入管理");
  }
}

export async function grantDelegate(
  actor: Actor,
  groupId: string,
  input: {
    type: typeof groupDelegations.$inferSelect.type;
    identifier: string;
  },
) {
  await requireDelegationManager(actor, groupId);

  let subject: string;

  if (input.type === "user") {
    const user = await keycloak.resolveUser(input.identifier);
    if (!user.enabled) {
      throw new ApplicationError(422, "不能授权已停用的用户");
    }

    subject = user.id;
  } else {
    subject = (await keycloak.group(input.identifier)).id;
  }

  return audited(
    actor,
    {
      operation: "delegate.grant",
      groupId,
      target: subject,
      detail: { type: input.type },
    },
    async () => {
      await db
        .insert(groupDelegations)
        .values({
          groupId,
          type: input.type,
          subject,
          grantedBy: actor.subject,
        })
        .onConflictDoNothing();

      return { type: input.type, subject };
    },
  );
}

export async function revokeDelegate(
  actor: Actor,
  groupId: string,
  input: Pick<typeof groupDelegations.$inferSelect, "type" | "subject">,
) {
  await requireDelegationManager(actor, groupId);

  return audited(
    actor,
    {
      operation: "delegate.revoke",
      groupId,
      target: input.subject,
      detail: { type: input.type },
    },
    async () => {
      await db
        .delete(groupDelegations)
        .where(
          and(
            eq(groupDelegations.groupId, groupId),
            eq(groupDelegations.type, input.type),
            eq(groupDelegations.subject, input.subject),
          ),
        );

      return input;
    },
  );
}
