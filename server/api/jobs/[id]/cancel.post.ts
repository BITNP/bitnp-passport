import { cancelJob } from "#backend/jobs";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { id } = await getValidatedRouterParams(event, uuidRouteParams.parse);

  return cancelJob(actor, id);
});
