import { z } from "zod";

const input = z.object({ mode: z.enum(["login", "register"]) });

export default defineEventHandler(async (event) => {
  const { mode } = await readValidatedBody(event, input.parse);
  const url = await beginAuthentication(event, {
    type: "invitation",
    token: getRouterParam(event, "token")!,
    mode,
  });

  return { url: url.href };
});
