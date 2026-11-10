export function useMutation(refresh?: () => Promise<void>) {
  const message = useMessage();
  const running = ref<string | null>(null);

  async function submit(request: () => Promise<void>, action = "submit") {
    if (running.value) {
      return;
    }

    running.value = action;

    try {
      await request();
      await refresh?.();
    } catch (cause: any) {
      message.error(cause.data?.message ?? cause.message);

      if (cause.statusCode === 401) {
        await refreshNuxtData("portal-session");
      }
    } finally {
      running.value = null;
    }
  }

  return {
    submit,
    pending: computed(() => running.value !== null),
    running: readonly(running),
  };
}
