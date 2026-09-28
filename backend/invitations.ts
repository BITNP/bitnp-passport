import { randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { invitations, managedGroups } from "#database/schema";
import type {
  CreateInvitationInput,
  UpdateInvitationInput,
} from "#shared/invitations";
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

export async function createInvitation(
  actor: Actor,
  groupId: string,
  { days, note, allowRegistration }: CreateInvitationInput,
) {
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
        // 与关闭群组邀请使用同一行锁，确保新链接不会遗漏撤销
        const [group] = await tx
          .select({ allowInvites: managedGroups.allowInvites })
          .from(managedGroups)
          .where(eq(managedGroups.groupId, groupId))
          .for("update");
        if (!group?.allowInvites) {
          throw new ApplicationError(403, "此群组未开放邀请");
        }

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
}

export async function updateInvitation(
  actor: Actor,
  groupId: string,
  { id, note, allowRegistration }: UpdateInvitationInput,
) {
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
          .where(and(eq(invitations.id, id), eq(invitations.groupId, groupId)))
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
}

export async function renewInvitation(
  actor: Actor,
  groupId: string,
  id: string,
  days: number,
) {
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
        const [group] = await tx
          .select({ allowInvites: managedGroups.allowInvites })
          .from(managedGroups)
          .where(eq(managedGroups.groupId, groupId))
          .for("update");
        if (!group?.allowInvites) {
          throw new ApplicationError(403, "此群组未开放邀请");
        }

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
}

export async function revokeInvitation(
  actor: Actor,
  groupId: string,
  id: string,
) {
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
}

async function readActiveInvitation(token: string) {
  const [invitation] = await db
    .select({
      groupId: invitations.groupId,
      label: managedGroups.label,
      allowRegistration: invitations.allowRegistration,
      expiresAt: invitations.expiresAt,
    })
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

export async function authorizeInvitation(
  token: string,
  mode: "login" | "register",
) {
  const invitation = await readActiveInvitation(token);
  if (mode === "register" && !invitation.allowRegistration) {
    throw new ApplicationError(
      403,
      "此邀请未开启新账号注册入口，请使用已有账号登录",
    );
  }
}

export async function invitationInfo(token: string, actor: Actor | null) {
  const invitation = await readActiveInvitation(token);
  let joined = false;

  if (actor) {
    const groups = await keycloak.groupsForUser(actor.subject);
    joined = groups.some((group) => group.id === invitation.groupId);
  }

  return {
    label: invitation.label,
    allowRegistration: invitation.allowRegistration,
    expiresAt: invitation.expiresAt,
    joined,
  };
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
      target: { type: "invitation", id: reference.id },
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

        const groups = await keycloak.groupsForUser(actor.subject);
        if (groups.some((group) => group.id === invitation.groupId)) {
          return;
        }

        await keycloak.addMember(actor.subject, invitation.groupId);
      }),
  );
}
