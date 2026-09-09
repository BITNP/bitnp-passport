import { z } from "zod";

import { updateInvitationNote } from "#backend/invitations";

const input = z.object({
  id: z.uuid(),
  note: z.string().trim(),
});

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { id, note } = await readValidatedBody(event, input.parse);

  return updateInvitationNote(actor, getRouterParam(event, "id")!, id, note);
});
