import * as account from "#backend/account";

export default defineEventHandler(async (event) => {
  const session = await getPortalSession(event);

  return session ? account.session(session) : null;
});
