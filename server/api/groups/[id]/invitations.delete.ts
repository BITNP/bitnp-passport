import { z } from "zod";

import { revokeInvitation } from "#backend/groups";

const input = z.object({ id: z.uuid() });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { id } = await readValidatedBody(event, input.parse);

  return revokeInvitation(actor, getRouterParam(event, "id")!, id);
});
