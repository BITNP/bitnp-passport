import * as account from "#backend/account";

export default defineEventHandler(async (event) =>
  account.overview(await requireSession(event)),
);
