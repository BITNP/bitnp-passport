import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.email(), z.literal("")]).nullish(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  return account.updateProfile(
    session,
    await readValidatedBody(event, input.parse),
  );
});
