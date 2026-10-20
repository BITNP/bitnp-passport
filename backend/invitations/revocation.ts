import { and, inArray, isNull } from "drizzle-orm";

import { invitations, managedGroups } from "#database/schema";

import type { DatabaseTransaction } from "../database.ts";
import { db } from "../database.ts";

export async function revokeGroupInvitations(
  tx: DatabaseTransaction,
  groupIds: string[],
) {
  await tx
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        inArray(invitations.groupId, groupIds),
        isNull(invitations.revokedAt),
      ),
    );
}

export const closeGroupInvitations = (groupIds: string[]) =>
  db.transaction(async (tx) => {
    await tx
      .update(managedGroups)
      .set({ allowInvites: false })
      .where(inArray(managedGroups.groupId, groupIds));
    await revokeGroupInvitations(tx, groupIds);
  });
