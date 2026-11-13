import { z } from "zod";

import * as account from "#backend/account";

const input = z
  .object({
    name: z.string().trim().min(1),
    email: z.union([z.email(), z.literal("")]).nullable(),
    qqNumber: z
      .string()
      .trim()
      .transform((value) => value || null)
      .nullable()
      .optional(),
    githubUsername: githubUsernameInput,
  })
  .strict();

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  return account.updateProfile(
    session,
    await readValidatedBody(event, input.parse),
  );
});
