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
    rows.push(
      ...(await Promise.all(
        identifiers.slice(offset, offset + 8).map(async (identifier) => {
          try {
            const user = await keycloak.resolveUser(identifier);

            return {
              identifier,
              user,
              member: memberIds.has(user.id),
              error: null,
            };
          } catch (error) {
            if (
              !(error instanceof ApplicationError) ||
              error.statusCode >= 500
            ) {
              throw error;
            }

            return {
              identifier,
              user: null,
              member: false,
              error: error.message,
            };
          }
        }),
      )),
    );
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
