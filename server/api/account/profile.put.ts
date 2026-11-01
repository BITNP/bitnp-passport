import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.email(), z.literal("")]).nullable(),
  qqNumber: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{5,12}$/.test(value),
      "QQ 号应为 5 至 12 位数字",
    )
    .transform((value) => value || null)
    .nullable(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  return account.updateProfile(
    session,
    await readValidatedBody(event, input.parse),
  );
});
