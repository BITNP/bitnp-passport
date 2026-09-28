export default defineEventHandler(async (event) => {
  const url = await beginAuthentication(event, { type: "reset-password" });

  return sendRedirect(event, url.href, 302);
});
