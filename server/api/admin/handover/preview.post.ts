import { previewHandover } from "#backend/handover";
import { handoverInput } from "#shared/handover";

export default defineEventHandler(async (event) =>
  previewHandover(
    await requireSession(event),
    await readValidatedBody(event, handoverInput.parse),
  ),
);
