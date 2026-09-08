import { z } from "zod";

import { grantDelegate } from "#backend/groups";

const input = z.object({
  groupId: z.string().min(1),
  type: z.enum(["user", "group"]),
  identifier: z.string().trim().min(1),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { groupId, ...delegate } = await readValidatedBody(event, input.parse);

  return grantDelegate(actor, groupId, delegate);
});
