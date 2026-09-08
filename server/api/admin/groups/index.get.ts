import { listGroups } from "#backend/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return listGroups(actor);
});
