import { z } from "zod";

import { renewInvitation } from "#backend/invitations";

const input = z.object({
  id: z.uuid(),
  days: z.number().int().min(1).max(30),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { id, days } = await readValidatedBody(event, input.parse);

  return renewInvitation(actor, getRouterParam(event, "id")!, id, days);
});
