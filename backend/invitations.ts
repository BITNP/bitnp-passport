import { randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { invitations, managedGroups } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { config } from "./config.ts";
import { randomToken } from "./crypto.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { requireGroupManager } from "./permissions.ts";

export async function listInvitations(actor: Actor, groupId: string) {
  await requireGroupManager(actor, groupId);

  const rows = await db
    .select({
      id: invitations.id,
      token: invitations.token,
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

export async function createInvitation(
  actor: Actor,
  groupId: string,
  days: number,
) {
  await requireGroupManager(actor, groupId);

  const id = randomUUID();
  const token = randomToken();

  return audited(
    actor,
    { operation: "invitation.create", groupId, target: id, detail: { days } },
    () =>
      db.transaction(async (tx) => {
        // 与关闭群组邀请使用同一行锁，确保新链接不会遗漏撤销
        const [group] = await tx
          .select({ allowInvites: managedGroups.allowInvites })
          .from(managedGroups)
          .where(eq(managedGroups.groupId, groupId))
          .for("update");
        if (!group!.allowInvites) {
          throw new ApplicationError(403, "此群组未开放邀请");
        }

        const createdAt = new Date();

        await tx.insert(invitations).values({
          id,
          token,
          groupId,
          createdBy: actor.subject,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + days * 86_400_000),
        });
      }),
  );
}

export async function revokeInvitation(
  actor: Actor,
  groupId: string,
  id: string,
) {
  await requireGroupManager(actor, groupId);

  return audited(
    actor,
    { operation: "invitation.revoke", groupId, target: id },
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
}

export async function invitationInfo(token: string) {
  const [invitation] = await db
    .select({ label: managedGroups.label, expiresAt: invitations.expiresAt })
    .from(invitations)
    .innerJoin(managedGroups, eq(invitations.groupId, managedGroups.groupId))
    .where(
      and(
        eq(invitations.token, token),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
        eq(managedGroups.allowInvites, true),
      ),
    )
    .limit(1);
  if (!invitation) {
    throw new ApplicationError(404, "邀请链接无效");
  }

  return invitation;
}

export async function joinInvitation(actor: Actor, token: string) {
  const reference = await db.query.invitations.findFirst({
    columns: { id: true, groupId: true },
    where: eq(invitations.token, token),
  });
  if (!reference) {
    throw new ApplicationError(404, "邀请链接无效");
  }

  return audited(
    actor,
    {
      operation: "invitation.join",
      groupId: reference.groupId,
      target: actor.subject,
    },
    () =>
      db.transaction(async (tx) => {
        const [invitation] = await tx
          .select({ groupId: managedGroups.groupId })
          .from(invitations)
          .innerJoin(
            managedGroups,
            eq(invitations.groupId, managedGroups.groupId),
          )
          .where(
            and(
              eq(invitations.id, reference.id),
              isNull(invitations.revokedAt),
              gt(invitations.expiresAt, new Date()),
              eq(managedGroups.allowInvites, true),
            ),
          )
          .for("update");
        if (!invitation) {
          throw new ApplicationError(404, "邀请链接无效");
        }

        await keycloak.addMember(actor.subject, invitation.groupId);
      }),
  );
}
