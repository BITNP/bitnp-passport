import { z } from "zod";

import { previewMembers } from "#backend/batch";

const input = z.object({ text: z.string() });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  const { text } = await readValidatedBody(event, input.parse);

  return previewMembers(actor, getRouterParam(event, "id")!, text);
});
