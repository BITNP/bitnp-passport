import { configuration } from "#backend/config";

export default defineEventHandler(() => {
  const config = configuration();

  return {
    registration: config.registration,
    supportUrl: config.supportUrl,
    services: config.services,
  };
});
