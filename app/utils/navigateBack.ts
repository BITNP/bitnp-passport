import type { RouteLocationRaw } from "vue-router";

export function navigateBack(fallback: RouteLocationRaw) {
  if (window.history.state?.back) {
    useRouter().back();

    return;
  }

  return navigateTo(fallback);
}
