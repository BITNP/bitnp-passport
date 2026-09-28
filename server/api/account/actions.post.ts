import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({ action: z.string().min(1) });

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const { action } = await readValidatedBody(event, input.parse);

  await account.requireAction(session.accessToken, action);

  const url = await beginAuthentication(event, {
    type: "account-action",
    user: session,
    action,
  });

  return { url: url.href };
});
