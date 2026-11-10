import { assignmentInput, changeAssignment } from "#backend/appointments";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  const input = await readValidatedBody(event, assignmentInput.parse);

  return changeAssignment(actor, routeParam(event, "id"), input);
});
