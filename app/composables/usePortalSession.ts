export const usePortalSession = () =>
  useFetch("/api/session", { key: "portal-session" });
