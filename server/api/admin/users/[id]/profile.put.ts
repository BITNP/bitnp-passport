import { updateUserProfile } from "#backend/account";
import { adminProfileInput } from "#shared/user";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return updateUserProfile(
    actor,
    routeParam(event, "id"),
    await readValidatedBody(event, adminProfileInput.parse),
  );
});
