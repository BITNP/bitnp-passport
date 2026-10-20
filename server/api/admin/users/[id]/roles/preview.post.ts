import { assignmentInput, previewAssignment } from "#backend/appointments";
import { requireAdministrator } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  await requireAdministrator(actor);

  const input = await readValidatedBody(event, assignmentInput.parse);

  return previewAssignment(getRouterParam(event, "id")!, input);
});
