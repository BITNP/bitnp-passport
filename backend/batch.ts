import type { Actor, MembershipPreview } from "#shared/types";

import { ApplicationError } from "./errors.ts";
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
  if (identifiers.length === 0 || identifiers.length > 200) {
    throw new ApplicationError(422, "请输入 1 至 200 个用户名或邮箱");
  }

  const members = await keycloak.members(groupId);
  const memberIds = new Set(members.map((user) => user.id));
  const rows: MembershipPreview["rows"] = [];

  for (let offset = 0; offset < identifiers.length; offset += 8) {
    const batch = identifiers.slice(offset, offset + 8);
    const results = await Promise.allSettled(
      batch.map((identifier) => keycloak.resolveUser(identifier)),
    );

    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        rows.push({
          identifier: batch[index]!,
          user: result.value,
          member: memberIds.has(result.value.id),
          error: null,
        });
      } else {
        if (
          !(result.reason instanceof ApplicationError) ||
          result.reason.statusCode >= 500
        ) {
          throw result.reason;
        }

        rows.push({
          identifier: batch[index]!,
          user: null,
          member: false,
          error: result.reason.message,
        });
      }
    }
  }

  const resolved = new Set(
    rows.flatMap((row) => (row.user ? [row.user.id] : [])),
  );

  return {
    rows,
    outside: members.filter((user) => !resolved.has(user.id)),
    memberCount: members.length,
  };
}
