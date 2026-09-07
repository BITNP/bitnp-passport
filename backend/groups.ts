import { randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { groupDelegations, invitations, managedGroups } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { configuration } from "./config.ts";
import { randomToken, tokenHash } from "./crypto.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator, requireGroupManager } from "./permissions.ts";

export const groupConfiguration = z.object({
  groupId: z.string().min(1).max(200),
  label: z.string().trim().min(1).max(80),
  note: z.string().trim().max(2000),
  allowInvites: z.boolean(),
});

export async function listGroups(actor: Actor, search: string, first: number) {
  await requireAdministrator(actor);

  const groups = await keycloak.searchGroups(search, first);

  return { groups, first, hasMore: groups.length === 50 };
}

export async function groupDetail(
  actor: Actor,
  groupId: string,
  first: number,
) {
  const settings = await requireGroupManager(actor, groupId);

  const [directory, members, delegates, links] = await Promise.all([
    keycloak.group(groupId),
    keycloak.memberPage(groupId, first),
    db
      .select()
      .from(groupDelegations)
      .where(eq(groupDelegations.groupId, groupId))
      .orderBy(groupDelegations.createdAt),
    db
      .select({
        id: invitations.id,
        createdBy: invitations.createdBy,
        createdAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
        revokedAt: invitations.revokedAt,
      })
      .from(invitations)
      .where(eq(invitations.groupId, groupId))
      .orderBy(desc(invitations.createdAt))
      .limit(20),
  ]);

  return {
    settings,
    directory,
    members,
    delegates,
    invitations: links,
    first,
    hasMore: members.length === 50,
  };
}

export async function configureGroup(
  actor: Actor,
  input: z.infer<typeof groupConfiguration>,
) {
  await requireAdministrator(actor);

  await keycloak.group(input.groupId);

  return audited(
    actor,
    { operation: "group.configure", groupId: input.groupId, detail: input },
    async () =>
      db.transaction(async (tx) => {
        const [group] = await tx
          .insert(managedGroups)
          .values({ ...input, createdBy: actor.subject })
          .onConflictDoUpdate({
            target: managedGroups.groupId,
            set: {
              label: input.label,
              note: input.note,
              allowInvites: input.allowInvites,
            },
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
      }),
  );
}

export async function createGroup(
  actor: Actor,
  name: string,
  parentId?: string,
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: "group.create", detail: { name, parentId } },
    async () => {
      const group = await keycloak.createGroup(name, parentId);

      await db
        .insert(managedGroups)
        .values({ groupId: group.id, label: name, createdBy: actor.subject })
        .onConflictDoNothing();

      return group;
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
  identifier: string,
) {
  await requireDelegationManager(actor, groupId);

  const user = await keycloak.resolveUser(identifier);
  if (!user.enabled) {
    throw new ApplicationError(422, "不能授权已停用的用户");
  }

  return audited(
    actor,
    {
      operation: "delegate.grant",
      groupId,
      target: user.id,
    },
    async () => {
      await db
        .insert(groupDelegations)
        .values({ groupId, subject: user.id, grantedBy: actor.subject })
        .onConflictDoNothing();

      return { subject: user.id };
    },
  );
}

export async function revokeDelegate(
  actor: Actor,
  groupId: string,
  subject: string,
) {
  await requireDelegationManager(actor, groupId);

  return audited(
    actor,
    { operation: "delegate.revoke", groupId, target: subject },
    async () => {
      await db
        .delete(groupDelegations)
        .where(
          and(
            eq(groupDelegations.groupId, groupId),
            eq(groupDelegations.subject, subject),
          ),
        );

      return { subject };
    },
  );
}

export async function createInvitation(
  actor: Actor,
  groupId: string,
  days: number,
) {
  await requireGroupManager(actor, groupId);

  const token = randomToken();

  return audited(
    actor,
    { operation: "invitation.rotate", groupId, detail: { days } },
    async () => {
      const expiresAt = await db.transaction(async (tx) => {
        const [group] = await tx
          .select()
          .from(managedGroups)
          .where(eq(managedGroups.groupId, groupId))
          .for("update");
        if (!group?.allowInvites) {
          throw new ApplicationError(
            403,
            "此群组暂未开放邀请，请联系系统管理员",
          );
        }

        const createdAt = new Date();
        const expiry = new Date(createdAt.getTime() + days * 86_400_000);

        await tx
          .update(invitations)
          .set({ revokedAt: createdAt })
          .where(
            and(
              eq(invitations.groupId, groupId),
              isNull(invitations.revokedAt),
            ),
          );

        await tx.insert(invitations).values({
          id: randomUUID(),
          tokenHash: tokenHash(token),
          groupId,
          createdBy: actor.subject,
          createdAt,
          expiresAt: expiry,
        });

        return expiry;
      });

      return { url: `${configuration().appUrl}/i/${token}`, expiresAt };
    },
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

      return { revoked: true };
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
        eq(invitations.tokenHash, tokenHash(token)),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
        eq(managedGroups.allowInvites, true),
      ),
    )
    .limit(1);
  if (!invitation) {
    throw new ApplicationError(404, "邀请链接已过期、已撤销或不存在");
  }

  return invitation;
}

export async function joinInvitation(actor: Actor, token: string) {
  const reference = await db.query.invitations.findFirst({
    columns: { id: true, groupId: true },
    where: eq(invitations.tokenHash, tokenHash(token)),
  });
  if (!reference) {
    throw new ApplicationError(404, "邀请链接已过期、已撤销或不存在");
  }

  return audited(
    actor,
    {
      operation: "invitation.join",
      groupId: reference.groupId,
      target: actor.subject,
    },
    async () =>
      db.transaction(async (tx) => {
        const [invitation] = await tx
          .select({
            groupId: managedGroups.groupId,
            label: managedGroups.label,
          })
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
          throw new ApplicationError(404, "邀请链接已过期、已撤销或不存在");
        }

        await keycloak.addMember(actor.subject, invitation.groupId);

        return invitation;
      }),
  );
}
