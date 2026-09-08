import { z } from "zod";

import { revokeDelegate } from "#backend/groups";

const input = z.object({
  groupId: z.string().min(1),
  type: z.enum(["user", "group"]),
  subject: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { groupId, ...delegate } = await readValidatedBody(event, input.parse);

  return revokeDelegate(actor, groupId, delegate);
});
