export default defineEventHandler(async (event) => {
  const url = await beginAuthorization(event, getQuery(event).returnTo);

  return sendRedirect(event, url.href, 302);
});
