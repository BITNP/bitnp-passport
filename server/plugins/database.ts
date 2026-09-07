import { closeDatabase } from "#backend/database";
import { closeQueue } from "#backend/queue";

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("close", () => closeQueue().finally(closeDatabase));
});
