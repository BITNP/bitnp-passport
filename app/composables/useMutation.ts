export function useMutation(refresh?: () => Promise<void>) {
  const message = useMessage();
  const pending = ref(false);

  async function submit(request: () => Promise<void>) {
    if (pending.value) {
      return;
    }

    pending.value = true;

    try {
      await request();
      await refresh?.();
    } catch (cause: any) {
      message.error(cause.data?.message ?? cause.message);

      if (cause.statusCode === 401) {
        await refreshNuxtData("portal-session");
      }
    } finally {
      pending.value = false;
    }
  }

  return { submit, pending };
}
