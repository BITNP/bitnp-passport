import { listGroups } from "#backend/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { search, first } = await getValidatedQuery(event, searchQuery.parse);

  return listGroups(actor, search, first);
});
