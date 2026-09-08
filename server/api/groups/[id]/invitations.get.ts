import { listInvitations } from "#backend/invitations";

export default defineEventHandler(async (event) =>
  listInvitations(await requireSession(event), getRouterParam(event, "id")!),
);
