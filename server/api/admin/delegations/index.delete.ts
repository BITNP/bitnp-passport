import { z } from "zod";

import { revokeDelegate } from "#backend/groups";

const input = z.object({
  groupId: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { groupId, subject } = await readValidatedBody(event, input.parse);

  return revokeDelegate(actor, groupId, subject);
});
