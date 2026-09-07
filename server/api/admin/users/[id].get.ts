import { userDetail } from "#backend/users";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return userDetail(actor, getRouterParam(event, "id")!);
});
