import { createHandoverJob } from "#backend/handover";
import { handoverInput } from "#shared/handover";

export default defineEventHandler(async (event) =>
  createHandoverJob(
    await requireSession(event),
    await readValidatedBody(event, handoverInput.parse),
  ),
);
