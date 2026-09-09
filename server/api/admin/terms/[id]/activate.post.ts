import { activateTerm, activationInput } from "#backend/terms/activation";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { id } = await getValidatedRouterParams(event, uuidRouteParams.parse);

  return activateTerm(
    actor,
    id,
    await readValidatedBody(event, activationInput.parse),
  );
});
