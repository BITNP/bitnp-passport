import pino from "pino";

export const logger = pino({
  name: "bitnp-pass",
  level: process.env.LOG_LEVEL ?? "info",
});
