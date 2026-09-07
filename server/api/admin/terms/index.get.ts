import { listTerms } from "#backend/terms";

export default defineEventHandler(async (event) =>
  listTerms(await requireSession(event)),
);
