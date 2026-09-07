import * as account from "#backend/account";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  return account.profile(session.accessToken);
});
