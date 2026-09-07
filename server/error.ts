import { FetchError } from "ofetch";

import { errorMessage } from "#backend/errors";
import { logger } from "#backend/logger";

export default defineNitroErrorHandler((error, event) => {
  // H3 already copies the HTTP status and data but marks FetchError as unhandled
  if (error.cause instanceof FetchError && error.cause.response) {
    error.unhandled = false;
  } else if (error.unhandled) {
    error.statusCode = 500;
  }

  if (error.statusCode >= 500) {
    (event.context.log ?? logger).error(
      {
        err: error,
        // Route patterns exclude invitation tokens and authentication query parameters
        route: event.context.matchedRoute?.path,
      },
      "HTTP 请求失败",
    );
  }

  if (!error.unhandled && !error.fatal) {
    return;
  }

  error.message = errorMessage(error);
  error.data = undefined;

  // Prevent Nitro from logging the full request URL
  error.unhandled = false;
  error.fatal = false;
});
