import { randomUUID } from "node:crypto";

import type { Logger } from "pino";

import { logger } from "#backend/logger";

declare module "h3" {
  interface H3EventContext {
    log: Logger;
  }
}

export default defineEventHandler((event) => {
  // Nuxt renders error pages through an internal request. keep the original response ID
  if (event.path.startsWith("/__nuxt_error")) {
    return;
  }

  const requestId = randomUUID();
  event.context.log = logger.child({
    component: "web",
    requestId,
    method: event.method,
  });

  setHeader(event, "X-Request-Id", requestId);
});
