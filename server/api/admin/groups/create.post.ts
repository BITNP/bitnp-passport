import { createGroup } from "#backend/groups";
import { createGroupInput } from "#shared/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return createGroup(
    actor,
    await readValidatedBody(event, createGroupInput.parse),
  );
});
