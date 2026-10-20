import { handoverStatus } from "#backend/handover";

export default defineEventHandler(async (event) =>
  handoverStatus(await requireSession(event)),
);
