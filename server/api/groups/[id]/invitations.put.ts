import { updateInvitation } from "#backend/invitations";
import { updateInvitationInput } from "#shared/invitations";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const input = await readValidatedBody(event, updateInvitationInput.parse);

  return updateInvitation(actor, getRouterParam(event, "id")!, input);
});
