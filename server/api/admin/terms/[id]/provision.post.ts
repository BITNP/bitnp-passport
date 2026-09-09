import { provisionTerm } from "#backend/terms/creation";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const { id } = await getValidatedRouterParams(event, uuidRouteParams.parse);

  return provisionTerm(actor, id);
});
