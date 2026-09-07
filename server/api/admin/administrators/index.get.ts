import { administrators } from "#backend/administrators";

export default defineEventHandler(async (event) =>
  administrators(await requireSession(event)),
);
