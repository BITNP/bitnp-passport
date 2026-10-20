import { z } from "zod";

import { appointmentRoles } from "./identity.ts";

const subjects = z
  .array(z.string().min(1))
  .transform((ids) => [...new Set(ids)]);

const appointment = z.strictObject({
  role: z.string().refine((role) => appointmentRoles.includes(role)),
  current: subjects,
  next: subjects,
});

export const handoverInput = z.strictObject({
  previousRootId: z.string().min(1),
  nextRootId: z.string().min(1),
  appointments: z
    .array(appointment)
    .length(appointmentRoles.length)
    .refine(
      (items) =>
        new Set(items.map((item) => item.role)).size ===
        appointmentRoles.length,
      "每项职务应恰好出现一次",
    ),
});

export type HandoverInput = z.infer<typeof handoverInput>;
