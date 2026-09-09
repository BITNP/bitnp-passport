import { saveTerm } from "#backend/terms";
import { termInput } from "#backend/terms/shared";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const input = await readValidatedBody(event, termInput.parse);
  const { id } = await getValidatedRouterParams(event, uuidRouteParams.parse);

  return saveTerm(actor, input, id);
});
