export default defineEventHandler(async (event) => {
  const url = await beginAuthentication(event, {
    type: "login",
    returnTo: getQuery(event).returnTo,
  });

  return sendRedirect(event, url.href, 302);
});
