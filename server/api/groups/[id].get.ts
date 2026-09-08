import { groupDetail } from "#backend/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return groupDetail(actor, getRouterParam(event, "id")!);
});
