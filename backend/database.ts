import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "#database/schema";

import { databaseUrl } from "./config.ts";
import { logger } from "./logger.ts";

export const db = drizzle({
  connection: {
    connectionString: databaseUrl(),
    max: 12,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
    application_name: "bitnp-pass",
  },
  schema,
});

db.$client.on("error", (err: unknown) => {
  logger.error({ err, component: "database" }, "PostgreSQL 连接异常");
});

export const closeDatabase = () => db.$client.end();
