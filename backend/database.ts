import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";

import * as schema from "#database/schema";

import { logger } from "./logger.ts";

export const databaseUrl = z
  .url({ protocol: /^postgres(?:ql)?$/ })
  .parse(process.env.DATABASE_URL);

const connection = {
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 30_000,
  application_name: "bitnp-passport",
};

export const db = drizzle({
  connection,
  schema,
});

export type DatabaseTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

const identityLock = new Pool({ ...connection, max: 1 });

function connectionError(err: unknown) {
  logger.error({ err, component: "database" }, "PostgreSQL 连接异常");
}

db.$client.on("error", connectionError);
identityLock.on("error", connectionError);

export async function withIdentityLock<T>(run: () => Promise<T>) {
  const client = await identityLock.connect();
  let reusable = false;

  try {
    await client.query(
      "select pg_advisory_lock(hashtextextended('bitnp-identity', 0))",
    );

    try {
      return await run();
    } finally {
      await client.query(
        "select pg_advisory_unlock(hashtextextended('bitnp-identity', 0))",
      );
      reusable = true;
    }
  } finally {
    client.release(!reusable);
  }
}

export async function closeDatabase() {
  await Promise.all([db.$client.end(), identityLock.end()]);
}
