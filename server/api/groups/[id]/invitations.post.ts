import { createInvitation } from "#backend/invitations";
import { createInvitationInput } from "#shared/invitations";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const input = await readValidatedBody(event, createInvitationInput.parse);

  return createInvitation(actor, getRouterParam(event, "id")!, input);
});
