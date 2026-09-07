import { z } from "zod";

import { revokeAdministrator } from "#backend/administrators";

const input = z.object({ subject: z.string().min(1).max(200) });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { subject } = await readValidatedBody(event, input.parse);

  return revokeAdministrator(actor, subject);
});
