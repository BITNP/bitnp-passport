import * as account from "#backend/account";
import { profileInput } from "#shared/user";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  return account.updateProfile(
    session,
    await readValidatedBody(event, profileInput.parse),
  );
});
