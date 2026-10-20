import { managedGroups } from "#database/schema";

import { db } from "../database.ts";

export async function groupLabels() {
  const groups = await db
    .select({ groupId: managedGroups.groupId, label: managedGroups.label })
    .from(managedGroups);

  return new Map(groups.map(({ groupId, label }) => [groupId, label]));
}
