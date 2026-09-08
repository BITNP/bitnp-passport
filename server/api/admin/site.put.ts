import { z } from "zod";

import { updateSite } from "#backend/site";

const input = z.object({
  supportUrl: z.url({ protocol: /^(https?|mailto)$/ }),
  services: z.array(
    z.object({
      name: z.string().trim().min(1),
      url: z.url({ protocol: /^https?$/ }),
      description: z.string().optional(),
    }),
  ),
});

export default defineEventHandler(async (event) =>
  updateSite(
    await requireSession(event),
    await readValidatedBody(event, input.parse),
  ),
);
