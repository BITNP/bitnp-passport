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

  const [rows, inherited] = await Promise.all([
    db
      .select({ id: portalAdmins.subject })
      .from(portalAdmins)
      .orderBy(portalAdmins.createdAt),
    keycloak.administrators(),
  ]);
  const inheritedById = new Map(inherited.map((user) => [user.id, user]));
  const result = await Promise.all(
    rows.map(async ({ id }) => {
      const inheritedUser = inheritedById.get(id);
      if (inheritedUser) {
        inheritedById.delete(id);

        return { ...inheritedUser, source: "keycloak" as const };
      }

      try {
        return { ...(await keycloak.user(id)), source: "passport" as const };
      } catch (error) {
        // Keep grants visible after a 404 so they can still be revoked
        if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
          throw error;
        }

        return { id, username: null, source: "passport" as const };
      }
    }),
  );

  for (const user of inheritedById.values()) {
    result.push({ ...user, source: "keycloak" });
  }

  return result;
}

async function requireEditableAdministrator(subject: string) {
  if (await keycloak.isAdministrator(subject)) {
    throw new ApplicationError(
      409,
      "此人的管理员权限来自 Keycloak，请在 Keycloak 管理",
    );
  }
}

export async function grantAdministrator(actor: Actor, identifier: string) {
  await requireAdministrator(actor);

  const user = await keycloak.resolveUser(identifier);
  if (!user.enabled) {
    throw new ApplicationError(422, "不能授权已停用的用户");
  }

  return audited(
    actor,
    { operation: "admin.grant", target: { type: "user", id: user.id } },
    async () => {
      await requireEditableAdministrator(user.id);
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
    { operation: "admin.revoke", target: { type: "user", id: subject } },
    async () => {
      await requireEditableAdministrator(subject);
      await db.transaction(
        async (tx) => {
          await tx
            .delete(portalAdmins)
            .where(eq(portalAdmins.subject, subject));

          const remaining = await tx.query.portalAdmins.findFirst({
            columns: { subject: true },
          });
          if (
            !remaining &&
            !(await keycloak.administrators()).some((user) => user.enabled)
          ) {
            throw new ApplicationError(409, "必须保留至少一位系统管理员");
          }
        },
        { isolationLevel: "serializable" },
      );
    },
  );
}
