import { createFromTerm, creationInput } from "#backend/terms/creation";

export default defineEventHandler(async (event) =>
  createFromTerm(
    await requireSession(event),
    await readValidatedBody(event, creationInput.parse),
  ),
);
