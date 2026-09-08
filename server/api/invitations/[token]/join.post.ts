import { joinInvitation } from "#backend/invitations";

export default defineEventHandler(async (event) =>
  joinInvitation(await requireSession(event), getRouterParam(event, "token")!),
);
