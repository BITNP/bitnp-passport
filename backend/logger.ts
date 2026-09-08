import pino from "pino";

export const logger = pino({
  name: "bitnp-passport",
  level: process.env.LOG_LEVEL ?? "info",
});
