import { z } from "zod";

import { grantDelegate } from "#backend/groups";

const input = z.object({
  groupId: z.string().min(1).max(200),
  identifier: z.string().trim().min(1).max(254),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { groupId, identifier } = await readValidatedBody(event, input.parse);

  return grantDelegate(actor, groupId, identifier);
});
