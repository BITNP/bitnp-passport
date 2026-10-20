import { eq } from "drizzle-orm";

import { invitations, managedGroups } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "../audit.ts";
import { db, withIdentityLock } from "../database.ts";
import { ApplicationError } from "../errors.ts";
import * as keycloak from "../keycloak.ts";

async function readInvitation(token: string) {
  const [invitation] = await db
    .select({
      id: invitations.id,
      groupId: invitations.groupId,
      label: managedGroups.label,
      allowRegistration: invitations.allowRegistration,
      expiresAt: invitations.expiresAt,
      revokedAt: invitations.revokedAt,
      allowInvites: managedGroups.allowInvites,
      enrolled: managedGroups.enrolled,
    })
    .from(invitations)
    .innerJoin(managedGroups, eq(invitations.groupId, managedGroups.groupId))
    .where(eq(invitations.token, token));

  if (!invitation) {
    throw new ApplicationError(404, "邀请链接无效");
  }

  return invitation;
}

function requireActiveInvitation(
  invitation: Awaited<ReturnType<typeof readInvitation>>,
) {
  if (
    invitation.revokedAt !== null ||
    invitation.expiresAt.getTime() <= Date.now() ||
    !invitation.allowInvites ||
    !invitation.enrolled
  ) {
    throw new ApplicationError(404, "邀请链接无效");
  }
}

export async function authorizeInvitation(
  token: string,
  mode: "login" | "register",
) {
  const invitation = await readInvitation(token);
  requireActiveInvitation(invitation);

  if (mode === "register" && !invitation.allowRegistration) {
    throw new ApplicationError(
      403,
      "此邀请未开启新账号注册入口，请使用已有账号登录",
    );
  }
}

export async function invitationInfo(token: string, actor: Actor | null) {
  const invitation = await readInvitation(token);
  requireActiveInvitation(invitation);

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

export const joinInvitation = async (actor: Actor, token: string) =>
  withIdentityLock(async () => {
    if (!(await keycloak.user(actor.subject)).enabled) {
      throw new ApplicationError(403, "账户已停用，不能加入群组");
    }

    const invitation = await readInvitation(token);

    return audited(
      actor,
      {
        operation: "invitation.join",
        groupId: invitation.groupId,
        target: { type: "invitation", id: invitation.id },
      },
      async () => {
        requireActiveInvitation(invitation);

        const groups = await keycloak.groupsForUser(actor.subject);
        if (groups.some((group) => group.id === invitation.groupId)) {
          return;
        }

        await keycloak.addMember(actor.subject, invitation.groupId);
      },
    );
  });
