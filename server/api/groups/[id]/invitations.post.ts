import { z } from "zod";

import { createInvitation } from "#backend/groups";

const input = z.object({ days: z.number().int().min(1).max(30) });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { days } = await readValidatedBody(event, input.parse);

  return createInvitation(actor, getRouterParam(event, "id")!, days);
});
