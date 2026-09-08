import { closeDatabase, db } from "#backend/database";
import * as keycloak from "#backend/keycloak";
import { logger } from "#backend/logger";
import { auditEvents, portalAdmins } from "#database/schema";

const log = logger.child({ component: "bootstrap" });

try {
  const subject = process.argv[2];
  if (!subject) {
    throw new Error("用法：pnpm admin:bootstrap <Keycloak 用户 ID>");
  }

  const user = await keycloak.user(subject);
  if (!user.enabled) {
    throw new Error("不能授权已停用的用户");
  }

  await db.transaction(
    async (tx) => {
      const existing = await tx.query.portalAdmins.findFirst({
        columns: { subject: true },
      });
      if (existing) {
        throw new Error("已有系统管理员，请通过管理页面授权");
      }

      await tx.insert(portalAdmins).values({ subject, grantedBy: "bootstrap" });

      await tx.insert(auditEvents).values({
        actorSubject: "bootstrap",
        operation: "admin.grant",
        target: subject,
        outcome: "succeeded",
        completedAt: new Date(),
      });
    },
    { isolationLevel: "serializable" },
  );

  log.info({ subject }, "已设置首位系统管理员");
} catch (err) {
  log.fatal({ err }, "管理员初始化失败");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
