import { z } from "zod";

import * as account from "#backend/account";

const input = z
  .object({
    currentPassword: z.string().min(1).max(4096),
    newPassword: z.string().min(1).max(4096),
    confirmation: z.string().min(1).max(4096),
  })
  .refine((value) => value.newPassword === value.confirmation);

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  await account.updatePassword(
    session.accessToken,
    await readValidatedBody(event, input.parse),
  );

  return { success: true };
});
