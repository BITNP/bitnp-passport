import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { invitations, managedGroups } from "#database/schema";
import type {
  CreateInvitationInput,
  UpdateInvitationInput,
} from "#shared/invitations";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { config } from "./config.ts";
import { randomToken } from "./crypto.ts";
import type { DatabaseTransaction } from "./database.ts";
import { db, withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { requireGroupManager } from "./permissions.ts";

async function requireInvitationsOpen(
  tx: DatabaseTransaction,
  groupId: string,
) {
  const [group] = await tx
    .select({ allowInvites: managedGroups.allowInvites })
    .from(managedGroups)
    .where(eq(managedGroups.groupId, groupId))
    .for("update");

  if (!group?.allowInvites) {
    throw new ApplicationError(403, "此群组未开放邀请");
  }
}

export async function listInvitations(actor: Actor, groupId: string) {
  await requireGroupManager(actor, groupId);

  const rows = await db
    .select({
      id: invitations.id,
      token: invitations.token,
      note: invitations.note,
      allowRegistration: invitations.allowRegistration,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
      revokedAt: invitations.revokedAt,
    })
    .from(invitations)
    .where(eq(invitations.groupId, groupId))
    .orderBy(desc(invitations.createdAt), desc(invitations.id));

  return rows.map(({ token, ...invitation }) => ({
    ...invitation,
    url: `${config.appUrl}/i/${token}`,
  }));
}

export const createInvitation = async (
  actor: Actor,
  groupId: string,
  { days, note, allowRegistration }: CreateInvitationInput,
) =>
  withIdentityLock(async () => {
    await requireGroupManager(actor, groupId);

    const id = randomUUID();
    const token = randomToken();

    return audited(
      actor,
      {
        operation: "invitation.create",
        groupId,
        target: { type: "invitation", id },
        detail: { days, note, allowRegistration },
      },
      () =>
        db.transaction(async (tx) => {
          await requireInvitationsOpen(tx, groupId);

          const createdAt = new Date();

          await tx.insert(invitations).values({
            id,
            token,
            note,
            allowRegistration,
            groupId,
            createdBy: actor.subject,
            createdAt,
            expiresAt: new Date(createdAt.getTime() + days * 86_400_000),
          });
        }),
    );
  });

export const updateInvitation = async (
  actor: Actor,
  groupId: string,
  { id, note, allowRegistration }: UpdateInvitationInput,
) =>
  withIdentityLock(async () => {
    await requireGroupManager(actor, groupId);

    return audited(
      actor,
      {
        operation: "invitation.update",
        groupId,
        target: { type: "invitation", id },
        detail: { after: { note, allowRegistration } },
      },
      (recordBefore) =>
        db.transaction(async (tx) => {
          const [invitation] = await tx
            .select({
              note: invitations.note,
              allowRegistration: invitations.allowRegistration,
            })
            .from(invitations)
            .where(
              and(eq(invitations.id, id), eq(invitations.groupId, groupId)),
            )
            .for("update");
          if (!invitation) {
            throw new ApplicationError(404, "邀请不存在");
          }

          recordBefore(invitation);
          await tx
            .update(invitations)
            .set({ note, allowRegistration })
            .where(eq(invitations.id, id));
        }),
    );
  });

export const renewInvitation = async (
  actor: Actor,
  groupId: string,
  id: string,
  days: number,
) =>
  withIdentityLock(async () => {
    await requireGroupManager(actor, groupId);

    return audited(
      actor,
      {
        operation: "invitation.renew",
        groupId,
        target: { type: "invitation", id },
        detail: { days },
      },
      () =>
        db.transaction(async (tx) => {
          await requireInvitationsOpen(tx, groupId);

          const [invitation] = await tx
            .update(invitations)
            .set({
              expiresAt: sql`greatest(${invitations.expiresAt}, now()) + ${days} * interval '24 hours'`,
            })
            .where(
              and(
                eq(invitations.id, id),
                eq(invitations.groupId, groupId),
                // 只更新到期时间，不能恢复已撤销的链接
                isNull(invitations.revokedAt),
              ),
            )
            .returning({ id: invitations.id });

          if (!invitation) {
            throw new ApplicationError(404, "邀请不存在或已撤销");
          }
        }),
    );
  });

export const revokeInvitation = async (
  actor: Actor,
  groupId: string,
  id: string,
) =>
  withIdentityLock(async () => {
    await requireGroupManager(actor, groupId);

    return audited(
      actor,
      {
        operation: "invitation.revoke",
        groupId,
        target: { type: "invitation", id },
      },
      async () => {
        await db
          .update(invitations)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(invitations.id, id),
              eq(invitations.groupId, groupId),
              isNull(invitations.revokedAt),
            ),
          );
      },
    );
  });
