import { creationInput, previewCreateTerm } from "#backend/terms/creation";

export default defineEventHandler(async (event) =>
  previewCreateTerm(
    await requireSession(event),
    await readValidatedBody(event, creationInput.parse),
  ),
);
