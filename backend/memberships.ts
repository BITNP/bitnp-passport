import type { Actor, MembershipPreview } from "#shared/types";

import { audited } from "./audit.ts";
import { withIdentityLock } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { createJob } from "./jobs.ts";
import * as keycloak from "./keycloak.ts";
import { requireGroupManager } from "./permissions.ts";

export async function previewMembers(
  actor: Actor,
  groupId: string,
  text: string,
): Promise<MembershipPreview> {
  await requireGroupManager(actor, groupId);

  const lines = text.split("\n").map((line) => line.trim());
  const identifiers = [...new Set(lines.filter(Boolean))];

  const members = await keycloak.members(groupId);
  const memberIds = new Set(members.map((user) => user.id));
  const matched: MembershipPreview["matched"] = [];
  const unmatched: string[] = [];

  for (const identifier of identifiers) {
    try {
      const user = await keycloak.resolveUser(identifier);
      matched.push({ identifier, user, member: memberIds.has(user.id) });
    } catch (error) {
      if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
        throw error;
      }

      unmatched.push(identifier);
    }
  }

  const resolved = new Set(matched.map(({ user }) => user.id));

  return {
    matched,
    unmatched,
    outside: members.filter((user) => !resolved.has(user.id)),
    memberCount: members.length,
  };
}

export const addMember = async (
  actor: Actor,
  groupId: string,
  identifier: string,
) =>
  withIdentityLock(async () => {
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
  });

export const removeMember = async (
  actor: Actor,
  groupId: string,
  subject: string,
) =>
  withIdentityLock(async () => {
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
  });

export async function createMembershipJob(
  actor: Actor,
  groupId: string,
  subjects: string[],
  operation: "add" | "remove",
) {
  await requireGroupManager(actor, groupId);
  await keycloak.group(groupId);

  const members = [...new Set(subjects)];

  return createJob(actor, {
    groupId,
    data: { type: "membership" },
    items: members.map((itemKey) => ({ itemKey, operation })),
    detail: { operation, count: members.length },
  });
}
