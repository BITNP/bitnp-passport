import { setGroupEnrollment } from "#backend/groups";
import { groupEnrollmentInput } from "#shared/groups";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);

  return setGroupEnrollment(
    actor,
    await readValidatedBody(event, groupEnrollmentInput.parse),
  );
});
