import { z } from "zod";

const groupId = z.string().min(1);
const groupName = z
  .string()
  .trim()
  .min(1)
  .regex(/^[^/\p{Cc}]+$/u);

export const configureGroupInput = z.strictObject({
  groupId,
  name: groupName,
  settings: z
    .object({
      label: z.string().trim().min(1),
      note: z.string().trim(),
      allowInvites: z.boolean(),
    })
    .optional(),
});

export const createGroupInput = z.strictObject({
  name: groupName,
  parentId: groupId.optional(),
});

export const groupEnrollmentInput = z.strictObject({
  groupId,
  enrolled: z.boolean(),
});

export type ConfigureGroupInput = z.infer<typeof configureGroupInput>;
export type CreateGroupInput = z.infer<typeof createGroupInput>;
export type GroupEnrollmentInput = z.infer<typeof groupEnrollmentInput>;
