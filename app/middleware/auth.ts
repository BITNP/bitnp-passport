export default defineNuxtRouteMiddleware(async (to) => {
  const { data, error } = await usePortalSession();
  if (error.value) {
    throw error.value;
  }

  if (!data.value) {
    return navigateTo(
      `/auth/login?returnTo=${encodeURIComponent(to.fullPath)}`,
      { external: true },
    );
  }
});
