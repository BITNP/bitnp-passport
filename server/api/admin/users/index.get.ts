import { listUsers } from "#backend/users";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { search, first } = await getValidatedQuery(event, searchQuery.parse);

  return listUsers(actor, search, first);
});
