import { listJobs } from "#backend/jobs";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { first } = await getValidatedQuery(event, paginationQuery.parse);

  return listJobs(actor, first);
});
