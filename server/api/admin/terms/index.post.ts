import { createTerm, termInput } from "#backend/terms";

export default defineEventHandler(async (event) =>
  createTerm(
    await requireSession(event),
    await readValidatedBody(event, termInput.parse),
  ),
);
