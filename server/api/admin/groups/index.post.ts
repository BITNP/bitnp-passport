import { configureGroup, groupConfiguration } from "#backend/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return configureGroup(
    actor,
    await readValidatedBody(event, groupConfiguration.parse),
  );
});
