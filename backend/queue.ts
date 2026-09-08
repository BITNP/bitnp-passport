import { PgBoss } from "pg-boss";

import { databaseUrl } from "./database.ts";
import { logger } from "./logger.ts";

export const operationQueue = "account-operations";
export const failedQueue = "account-operations-failed";
export const cleanupQueue = "account-cleanup";

const connection = new PgBoss({
  connectionString: databaseUrl,
  migrate: false,
  max: 5,
});

connection.on("error", (err: unknown) => {
  logger.error({ err, component: "queue" }, "后台任务队列异常");
});

export async function queue() {
  try {
    return await connection.start();
  } catch (error) {
    await connection.stop();

    throw error;
  }
}

export const closeQueue = () => connection.stop();
