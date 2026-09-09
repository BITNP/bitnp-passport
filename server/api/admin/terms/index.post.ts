import { saveTerm } from "#backend/terms";
import { termInput } from "#backend/terms/shared";

export default defineEventHandler(async (event) =>
  saveTerm(
    await requireSession(event),
    await readValidatedBody(event, termInput.parse),
  ),
);
