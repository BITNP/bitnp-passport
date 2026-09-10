import { z } from "zod";

import { departments } from "#database/schema";
import type { Actor } from "#shared/types";

import { audited } from "./audit.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { requireAdministrator } from "./permissions.ts";

export const departmentInput = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^/\p{Cc}]+$/u),
  name: z.string().trim().min(1),
});

export async function createDepartment(
  actor: Actor,
  input: z.infer<typeof departmentInput>,
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    {
      operation: "department.create",
      detail: {
        before: null,
        after: { code: input.code, departmentName: input.name },
      },
    },
    async () => {
      const [department] = await db
        .insert(departments)
        .values({ ...input, createdBy: actor.subject })
        .onConflictDoNothing()
        .returning({ code: departments.code, name: departments.name });
      if (!department) {
        throw new ApplicationError(409, "部门标识已存在，请选择已有部门");
      }

      return department;
    },
  );
}
