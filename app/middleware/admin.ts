export default defineNuxtRouteMiddleware(async () => {
  const { data } = await usePortalSession();

  if (!data.value?.administrator) {
    throw createError({ statusCode: 403, message: "此页面需要系统管理员权限" });
  }
});
