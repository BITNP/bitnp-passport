import * as account from "#backend/account";

export default defineEventHandler(async (event) =>
  account.removeAvatar(await requireSession(event)),
);
