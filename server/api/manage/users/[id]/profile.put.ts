import { updateMemberProfile } from "#backend/account";
import { memberProfileInput } from "#shared/user";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const input = await readValidatedBody(event, memberProfileInput.parse);

  return updateMemberProfile(actor, routeParam(event, "id"), input);
});
