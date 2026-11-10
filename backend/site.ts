import { eq } from "drizzle-orm";

import { siteSettings } from "#database/schema";
import type { Actor } from "#shared/types";

import { auditedConfigurationChange } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { requireAdministrator } from "./permissions.ts";

const missingSettingsMessage = "站点设置缺失，请运行数据库迁移";

export async function readSite() {
  const settings = await db.query.siteSettings.findFirst({
    columns: { id: false },
  });

  if (!settings) {
    throw new ApplicationError(503, missingSettingsMessage);
  }

  return settings;
}

export async function updateSite(
  actor: Actor,
  input: Omit<typeof siteSettings.$inferInsert, "id">,
) {
  await requireAdministrator(actor);

  return auditedConfigurationChange(
    actor,
    { operation: "site.update", detail: { after: input } },
    (recordBefore) =>
      db.transaction(async (tx) => {
        const [previous] = await tx
          .select()
          .from(siteSettings)
          .where(eq(siteSettings.id, true))
          .for("update");
        if (!previous) {
          throw new ApplicationError(503, missingSettingsMessage);
        }

        recordBefore(previous);

        await tx
          .update(siteSettings)
          .set(input)
          .where(eq(siteSettings.id, true));

        return input;
      }),
  );
}
