import { z } from "zod";

import { grantAdministrator } from "#backend/administrators";

const input = z.object({ identifier: z.string().trim().min(1).max(254) });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { identifier } = await readValidatedBody(event, input.parse);

  return grantAdministrator(actor, identifier);
});
