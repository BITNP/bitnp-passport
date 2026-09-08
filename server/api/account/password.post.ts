import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
  confirmation: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  await account.updatePassword(
    session.accessToken,
    await readValidatedBody(event, input.parse),
  );
});
