import { eq } from "drizzle-orm";

import { siteSettings } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { requireAdministrator } from "./permissions.ts";

export async function readSite() {
  const settings = await db.query.siteSettings.findFirst({
    columns: { id: false },
  });

  return settings!;
}

export async function updateSite(
  actor: Actor,
  input: Omit<typeof siteSettings.$inferInsert, "id">,
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: "site.update", detail: { after: input } },
    (recordBefore) =>
      db.transaction(async (tx) => {
        const [previous] = await tx
          .select()
          .from(siteSettings)
          .where(eq(siteSettings.id, true))
          .for("update");
        recordBefore(previous!);

        await tx
          .update(siteSettings)
          .set(input)
          .where(eq(siteSettings.id, true));

        return input;
      }),
  );
}
