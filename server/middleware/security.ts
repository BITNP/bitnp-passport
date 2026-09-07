import { configuration } from "#backend/config";
import { ApplicationError } from "#backend/errors";

export default defineEventHandler((event) => {
  setHeaders(event, {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });

  if (!event.path.startsWith("/_nuxt/")) {
    setHeader(event, "Cache-Control", "no-store");
  }

  if (
    event.path.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(event.method) &&
    getHeader(event, "origin") !== configuration().appUrl
  ) {
    throw new ApplicationError(403, "请求来源不合法");
  }
});
