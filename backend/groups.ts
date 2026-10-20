import { and, eq } from "drizzle-orm";

import { managedGroups } from "#database/schema";
import type {
  ConfigureGroupInput,
  CreateGroupInput,
  GroupEnrollmentInput,
} from "#shared/groups";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db, withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { revokeGroupInvitations } from "./invitations/revocation.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator, requireGroupManager } from "./permissions.ts";

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

  const [directory, members, settings] = await Promise.all([
    keycloak.group(groupId),
    keycloak.members(groupId),
    db.query.managedGroups.findFirst({
      columns: { groupId: true, label: true, note: true, allowInvites: true },
      where: eq(managedGroups.groupId, groupId),
    }),
  ]);

  return {
    settings: settings ?? null,
    directory,
    members,
  };
}

export const configureGroup = async (
  actor: Actor,
  input: ConfigureGroupInput,
) =>
  withIdentityLock(async () => {
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
              await revokeGroupInvitations(tx, [groupId]);
            }
          }

          return { groupId };
        }),
    );
  });

export const setGroupEnrollment = async (
  actor: Actor,
  { groupId, enrolled }: GroupEnrollmentInput,
) =>
  withIdentityLock(async () => {
    await requireAdministrator(actor);

    return audited(
      actor,
      { operation: enrolled ? "group.enroll" : "group.unenroll", groupId },
      () =>
        db.transaction(async (tx) => {
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
            await revokeGroupInvitations(tx, [groupId]);
          }

          return { groupId };
        }),
    );
  });

export const createGroup = async (actor: Actor, input: CreateGroupInput) =>
  withIdentityLock(async () => {
    await requireAdministrator(actor);

    return audited(
      actor,
      { operation: "group.create", detail: input },
      async () => ({
        groupId: await keycloak.createGroup(input.name, input.parentId),
      }),
    );
  });
