export default defineNuxtRouteMiddleware(async () => {
  const { data } = await usePortalSession();

  if (!data.value?.management) {
    throw createError({ statusCode: 403, message: "此页面需要管理层权限" });
  }
});
