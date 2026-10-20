import { configureGroup } from "#backend/groups";
import { configureGroupInput } from "#shared/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return configureGroup(
    actor,
    await readValidatedBody(event, configureGroupInput.parse),
  );
});
