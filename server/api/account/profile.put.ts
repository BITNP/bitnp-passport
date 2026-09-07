import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({
  firstName: z.string().trim().max(255).nullish(),
  lastName: z.string().trim().max(255).nullish(),
  email: z.union([z.email().max(254), z.literal("")]).nullish(),
});

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const profile = await account.updateProfile(
    session.accessToken,
    await readValidatedBody(event, input.parse),
  );

  await updateSessionProfile(session.subject, profile);

  return profile;
});
