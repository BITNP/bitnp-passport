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

  return db.select().from(portalAdmins).orderBy(portalAdmins.createdAt);
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

      return { subject: user.id, username: user.username };
    },
  );
}

export async function revokeAdministrator(actor: Actor, subject: string) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: "admin.revoke", target: subject },
    async () => {
      // 同时撤销最后两位管理员时，两次请求可能各自看到另一位仍在，导致全部被撤销
      // 用 serializable 事务将删除与剩余管理员检查作为整体
      await db.transaction(
        async (tx) => {
          const [removed] = await tx
            .delete(portalAdmins)
            .where(eq(portalAdmins.subject, subject))
            .returning({ subject: portalAdmins.subject });
          if (!removed) {
            return;
          }

          const remaining = await tx.query.portalAdmins.findFirst({
            columns: { subject: true },
          });
          if (!remaining) {
            throw new ApplicationError(409, "必须保留至少一位系统管理员");
          }
        },
        { isolationLevel: "serializable" },
      );

      return { revoked: true };
    },
  );
}
