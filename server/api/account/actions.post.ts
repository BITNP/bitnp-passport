import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({ action: z.string().min(1).max(200) });

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const { action } = await readValidatedBody(event, input.parse);

  await account.requireAction(session.accessToken, action);

  return { url: await beginAccountAction(event, session, action) };
});
