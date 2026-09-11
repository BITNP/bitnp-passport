import { closeDatabase, db } from "#backend/database";
import * as keycloak from "#backend/keycloak";
import { logger } from "#backend/logger";
import type { AuditRecord } from "#database/schema";
import { auditEvents, portalAdmins } from "#database/schema";

const log = logger.child({ component: "admin-grant" });

try {
  const subject = process.argv[2];
  if (!subject) {
    throw new Error("用法：pnpm admin:grant <Keycloak 用户 ID>");
  }

  const user = await keycloak.user(subject);
  if (!user.enabled) {
    throw new Error("不能授权已停用的用户");
  }

  if (await keycloak.isAdministrator(subject)) {
    throw new Error(
      "Keycloak 超级管理员已自动拥有通行证管理权限，请在 Keycloak 管理其权限",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(portalAdmins)
      .values({ subject, grantedBy: "admin-grant" })
      .onConflictDoNothing();

    await tx.insert(auditEvents).values({
      actorSubject: "admin-grant",
      operation: "admin.grant",
      target: { type: "user", id: subject },
      outcome: "succeeded",
      completedAt: new Date(),
    } satisfies AuditRecord);
  });

  log.info({ subject }, "已授予系统管理员权限");
} catch (err) {
  log.fatal({ err }, "管理员授权失败");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
