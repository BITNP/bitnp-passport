import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { PgBoss } from "pg-boss";

import { closeDatabase, databaseUrl, db } from "#backend/database";
import { logger } from "#backend/logger";
import { cleanupQueue, failedQueue, operationQueue } from "#backend/queue";

const log = logger.child({ component: "migrate" });

try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../database/migrations", import.meta.url),
    ),
  });

  const boss = new PgBoss({
    connectionString: databaseUrl,
    supervise: false,
    schedule: false,
  });
  boss.on("error", (err: unknown) => log.error({ err }, "任务队列初始化失败"));

  try {
    await boss.start();

    await boss.createQueue(failedQueue, {
      retryLimit: 20,
      retryDelay: 30,
      expireInSeconds: 60,
    });

    await boss.createQueue(operationQueue, {
      retryLimit: 3,
      retryDelay: 10,
      retryBackoff: true,
      heartbeatSeconds: 60,
      expireInSeconds: 3600,
      deadLetter: failedQueue,
    });

    await boss.createQueue(cleanupQueue, {
      retryLimit: 3,
      expireInSeconds: 60,
    });

    await boss.schedule(cleanupQueue, "*/10 * * * *");
  } finally {
    await boss.stop();
  }

  log.info("数据库和任务队列迁移完成");
} catch (err) {
  log.fatal({ err }, "数据库迁移失败");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
