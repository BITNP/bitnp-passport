import { z } from "zod";

export const uuidRouteParams = z.object({
  id: z.uuid(),
});

export const paginationQuery = z.object({
  first: z.coerce.number().int().min(0).default(0),
});

export const searchQuery = paginationQuery.extend({
  search: z.string().trim().default(""),
});
