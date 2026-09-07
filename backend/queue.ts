import { PgBoss } from "pg-boss";

import { databaseUrl } from "./config.ts";
import { logger } from "./logger.ts";

export const operationQueue = "account-operations";
export const failedQueue = "account-operations-failed";
export const cleanupQueue = "account-cleanup";

let connection: PgBoss | undefined;

export async function queue() {
  if (!connection) {
    connection = new PgBoss({
      connectionString: databaseUrl(),
      migrate: false,
      max: 5,
    });

    connection.on("error", (err: unknown) => {
      logger.error({ err, component: "queue" }, "后台任务队列异常");
    });
  }

  try {
    return await connection.start();
  } catch (error) {
    await connection.stop();

    throw error;
  }
}

export async function closeQueue() {
  await connection?.stop({ graceful: true, timeout: 30_000 });
}
