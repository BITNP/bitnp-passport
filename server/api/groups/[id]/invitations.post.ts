import { z } from "zod";

import { createInvitation } from "#backend/invitations";

const input = z.object({
  days: z.number().int().min(1).max(30),
  note: z.string().trim(),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const body = await readValidatedBody(event, input.parse);

  return createInvitation(actor, getRouterParam(event, "id")!, body);
});
