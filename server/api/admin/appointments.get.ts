import { appointmentHolders } from "#backend/appointments";
import { requireAdministrator } from "#backend/permissions";

export default defineEventHandler(async (event) => {
  const actor = await requireSession(event);
  await requireAdministrator(actor);

  return appointmentHolders();
});
