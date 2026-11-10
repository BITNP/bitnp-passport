import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({ id: z.string().min(1).optional() });

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const { id } = await readValidatedBody(event, input.parse);
  const result = await account.signOut(session, id);

  if (result.signedOut) {
    await deletePortalSession(event);
  }

  return result;
});
