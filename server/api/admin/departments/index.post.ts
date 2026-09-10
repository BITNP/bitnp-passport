import { createDepartment, departmentInput } from "#backend/departments";

export default defineEventHandler(async (event) =>
  createDepartment(
    await requireSession(event),
    await readValidatedBody(event, departmentInput.parse),
  ),
);
