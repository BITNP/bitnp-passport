import { z } from "zod";

import { updateUserProfile } from "#backend/account";

const input = z
  .object({
    name: z.string().trim(),
    email: z
      .union([z.email(), z.literal("")])
      .nullable()
      .transform((value) => (value === "" ? null : value)),
    qqNumber: z
      .string()
      .trim()
      .transform((value) => value || null)
      .nullable(),
    githubUsername: githubUsernameInput,
    enabled: z.boolean(),
    emailVerified: z.boolean(),
  })
  .strict()
  .refine((value) => value.email !== null || !value.emailVerified, {
    message: "未设置邮箱时不能标记为已验证",
    path: ["emailVerified"],
  });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return updateUserProfile(
    actor,
    getRouterParam(event, "id")!,
    await readValidatedBody(event, input.parse),
  );
});
