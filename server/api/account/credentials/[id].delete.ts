import * as account from "#backend/account";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const action = await account.removeCredential(
    session.accessToken,
    getRouterParam(event, "id")!,
  );

  const url = await beginAuthentication(event, {
    type: "account-action",
    user: session,
    action,
  });

  return { url: url.href };
});
