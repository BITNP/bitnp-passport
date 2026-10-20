import { z } from "zod";

import { prepareYearGroups } from "#backend/year-groups";

const input = z.strictObject({ year: z.number().int().min(1000).max(9999) });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { year } = await readValidatedBody(event, input.parse);

  return prepareYearGroups(actor, year);
});
