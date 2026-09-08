import { eq } from "drizzle-orm";

import { portalAdmins } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator } from "./permissions.ts";

export async function administrators(actor: Actor) {
  await requireAdministrator(actor);

  const rows = await db
    .select({ id: portalAdmins.subject })
    .from(portalAdmins)
    .orderBy(portalAdmins.createdAt);

  return Promise.all(
    rows.map(async ({ id }) => {
      try {
        return await keycloak.user(id);
      } catch (error) {
        // Keep grants visible after a 404 so they can still be revoked
        if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
          throw error;
        }

        return { id, username: null };
      }
    }),
  );
}

export async function grantAdministrator(actor: Actor, identifier: string) {
  await requireAdministrator(actor);

  const user = await keycloak.resolveUser(identifier);
  if (!user.enabled) {
    throw new ApplicationError(422, "不能授权已停用的用户");
  }

  return audited(
    actor,
    { operation: "admin.grant", target: user.id },
    async () => {
      await db
        .insert(portalAdmins)
        .values({ subject: user.id, grantedBy: actor.subject })
        .onConflictDoNothing();

      return { username: user.username };
    },
  );
}

export async function revokeAdministrator(actor: Actor, subject: string) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: "admin.revoke", target: subject },
    // 同时撤销最后两位管理员时，两次请求可能各自看到另一位仍在，导致全部被撤销
    // 用 serializable 事务将删除与剩余管理员检查作为整体
    () =>
      db.transaction(
        async (tx) => {
          await tx
            .delete(portalAdmins)
            .where(eq(portalAdmins.subject, subject));

          const remaining = await tx.query.portalAdmins.findFirst({
            columns: { subject: true },
          });
          if (!remaining) {
            throw new ApplicationError(409, "必须保留至少一位系统管理员");
          }
        },
        { isolationLevel: "serializable" },
      ),
  );
}
