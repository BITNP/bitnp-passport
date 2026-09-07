import { joinInvitation } from "#backend/groups";

export default defineEventHandler(async (event) =>
  joinInvitation(await requireSession(event), getRouterParam(event, "token")!),
);
