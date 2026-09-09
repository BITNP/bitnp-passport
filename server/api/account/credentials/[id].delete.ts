import * as account from "#backend/account";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const action = await account.removeCredential(
    session.accessToken,
    getRouterParam(event, "id")!,
  );

  return { url: await beginAccountAction(event, session, action) };
});
