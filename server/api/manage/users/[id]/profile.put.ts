import { z } from "zod";

import { updateMemberProfile } from "#backend/account";

const input = z
  .object({
    qqNumber: z
      .string()
      .trim()
      .transform((value) => value || null)
      .nullable(),
    githubUsername: githubUsernameInput,
  })
  .strict();

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return updateMemberProfile(
    actor,
    getRouterParam(event, "id")!,
    await readValidatedBody(event, input.parse),
  );
});
