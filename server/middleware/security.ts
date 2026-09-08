import { config } from "#backend/config";
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

  const { appUrl } = config;
  const url = getRequestURL(event);

  // Start authorization on the same origin that will receive the login cookie.
  if (
    event.method === "GET" &&
    url.pathname.startsWith("/auth/") &&
    url.origin !== appUrl
  ) {
    return sendRedirect(event, `${appUrl}${url.pathname}${url.search}`, 302);
  }

  if (
    event.path.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(event.method) &&
    getHeader(event, "origin") !== appUrl
  ) {
    throw new ApplicationError(403, "请求来源不合法");
  }
});
