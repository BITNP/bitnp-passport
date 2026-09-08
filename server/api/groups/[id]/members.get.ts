import { listMembers } from "#backend/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return listMembers(actor, getRouterParam(event, "id")!);
});
