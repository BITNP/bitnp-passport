export default defineEventHandler(async (event) =>
  sendRedirect(event, await completeAuthentication(event), 303),
);
