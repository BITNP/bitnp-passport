import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { groupDelegations, invitations, managedGroups } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator, requireGroupManager } from "./permissions.ts";

export const groupConfiguration = z.strictObject({
  groupId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^/\p{Cc}]+$/u),
  settings: z
    .object({
      label: z.string().trim().min(1),
      note: z.string().trim(),
      allowInvites: z.boolean(),
    })
    .optional(),
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
  await requireGroupManager(actor, groupId);

  const [directory, members, delegations, settings] = await Promise.all([
    keycloak.group(groupId),
    keycloak.members(groupId),
    db
      .select()
      .from(groupDelegations)
      .where(eq(groupDelegations.groupId, groupId))
      .orderBy(groupDelegations.createdAt),
    db.query.managedGroups.findFirst({
      where: eq(managedGroups.groupId, groupId),
    }),
  ]);

  const delegates = await Promise.all(
    delegations.map(async (delegation) => {
      let name: string | null;

      try {
        if (delegation.type === "user") {
          name = (await keycloak.user(delegation.subject)).username;
        } else {
          const [group, configuration] = await Promise.all([
            keycloak.group(delegation.subject),
            db.query.managedGroups.findFirst({
              columns: { label: true },
              where: eq(managedGroups.groupId, delegation.subject),
            }),
          ]);
          name = configuration?.label ?? group.name;
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
    settings: {
      groupId,
      label: settings?.label ?? directory.name,
      note: settings?.note ?? "",
      allowInvites: settings?.allowInvites ?? false,
    },
    directory,
    members,
    delegates,
  };
}

export async function listMembers(actor: Actor, groupId: string) {
  await requireGroupManager(actor, groupId);

  return keycloak.members(groupId);
}

export async function configureGroup(
  actor: Actor,
  input: z.infer<typeof groupConfiguration>,
) {
  await requireAdministrator(actor);

  const { groupId, name, settings } = input;

  return audited(
    actor,
    {
      operation: "group.configure",
      groupId,
      detail: { after: { name, ...settings } },
    },
    (recordBefore) =>
      db.transaction(async (tx) => {
        // 未纳入的群组没有元数据行，仍需与显式纳入操作按群组串行处理。
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${groupId}, 0))`,
        );
        const [previous] = await tx
          .select()
          .from(managedGroups)
          .where(eq(managedGroups.groupId, groupId))
          .for("update");
        if (settings && !previous?.enrolled) {
          throw new ApplicationError(
            409,
            "请先将群组纳入通行证，再保存通行证配置",
          );
        }

        const current = await keycloak.group(groupId);
        recordBefore({ name: current.name, ...previous });

        if (name !== current.name) {
          await keycloak.renameGroup(groupId, name);
        }

        if (settings) {
          await tx
            .update(managedGroups)
            .set(settings)
            .where(eq(managedGroups.groupId, groupId));

          if (!settings.allowInvites) {
            await tx
              .update(invitations)
              .set({ revokedAt: new Date() })
              .where(
                and(
                  eq(invitations.groupId, groupId),
                  isNull(invitations.revokedAt),
                ),
              );
          }
        }

        return { groupId };
      }),
  );
}

export async function setGroupEnrollment(
  actor: Actor,
  { groupId, enrolled }: { groupId: string; enrolled: boolean },
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: enrolled ? "group.enroll" : "group.unenroll", groupId },
    () =>
      db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${groupId}, 0))`,
        );

        if (enrolled) {
          const group = await keycloak.group(groupId);
          await tx
            .insert(managedGroups)
            .values({ groupId, label: group.name, createdBy: actor.subject })
            .onConflictDoUpdate({
              target: managedGroups.groupId,
              set: { enrolled: true },
              setWhere: eq(managedGroups.enrolled, false),
            });
        } else {
          // 先锁定群组并关闭邀请，再撤销链接，与邀请创建保持互斥。
          await tx
            .update(managedGroups)
            .set({ enrolled: false, allowInvites: false })
            .where(
              and(
                eq(managedGroups.groupId, groupId),
                eq(managedGroups.enrolled, true),
              ),
            );
          await tx
            .update(invitations)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(invitations.groupId, groupId),
                isNull(invitations.revokedAt),
              ),
            );
        }

        return { groupId };
      }),
  );
}

export async function createGroup(
  actor: Actor,
  input: { name: string; parentId?: string },
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: "group.create", detail: input },
    async () => ({
      groupId: await keycloak.createGroup(input.name, input.parentId),
    }),
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
      target: { type: "user", id: user.id },
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
    {
      operation: "member.remove",
      groupId,
      target: { type: "user", id: subject },
    },
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
  await keycloak.group(groupId);

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
      target: { type: input.type, id: subject },
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
      target: { type: input.type, id: input.subject },
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
