import { z } from "zod";

import { addMember } from "#backend/groups";

const input = z.object({ identifier: z.string().trim().min(1) });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { identifier } = await readValidatedBody(event, input.parse);

  return addMember(actor, getRouterParam(event, "id")!, identifier);
});
