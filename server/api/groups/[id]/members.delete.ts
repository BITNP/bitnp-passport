import { z } from "zod";

import { removeMember } from "#backend/groups";

const input = z.object({ subject: z.string().min(1) });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { subject } = await readValidatedBody(event, input.parse);

  return removeMember(actor, getRouterParam(event, "id")!, subject);
});
