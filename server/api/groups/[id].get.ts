import { groupDetail } from "#backend/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { first } = await getValidatedQuery(event, paginationQuery.parse);

  return groupDetail(actor, getRouterParam(event, "id")!, first);
});
