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

      await db.transaction(async (tx) => {
        await tx
          .insert(managedGroups)
          .values({ groupId, ...settings, createdBy: actor.subject })
          .onConflictDoUpdate({
            target: managedGroups.groupId,
            set: settings,
          });

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
      });

      return { groupId };
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

      await db
        .insert(managedGroups)
        .values({ groupId, ...settings, createdBy: actor.subject });

      return { groupId };
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
    () => keycloak.addMember(user.id, groupId),
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
    () => keycloak.removeMember(subject, groupId),
  );
}

export async function grantDelegate(
  actor: Actor,
  groupId: string,
  input: {
    type: typeof groupDelegations.$inferSelect.type;
    identifier: string;
  },
) {
  await requireAdministrator(actor);

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
    },
  );
}

export async function revokeDelegate(
  actor: Actor,
  groupId: string,
  input: Pick<typeof groupDelegations.$inferSelect, "type" | "subject">,
) {
  await requireAdministrator(actor);

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
    },
  );
}
