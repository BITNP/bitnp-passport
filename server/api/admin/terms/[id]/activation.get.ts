import { z } from "zod";

import { previewActivateTerm } from "#backend/terms/activation";

const input = z.object({ previousTermId: z.uuid().optional() });

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { id } = await getValidatedRouterParams(event, uuidRouteParams.parse);
  const { previousTermId } = await getValidatedQuery(event, input.parse);

  return previewActivateTerm(actor, id, previousTermId);
});
