import { termInput, updateTerm } from "#backend/terms";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const input = await readValidatedBody(event, termInput.parse);
  const { id } = await getValidatedRouterParams(event, uuidRouteParams.parse);

  return updateTerm(actor, id, input);
});
