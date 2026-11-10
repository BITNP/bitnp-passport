import { z } from "zod";

import { revokeInvitation } from "#backend/invitations";

const input = z.object({ id: z.uuid() });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { id } = await readValidatedBody(event, input.parse);

  return revokeInvitation(actor, routeParam(event, "id"), id);
});
