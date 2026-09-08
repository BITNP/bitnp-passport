import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.email(), z.literal("")]).nullish(),
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
