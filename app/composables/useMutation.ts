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
    } catch (cause: unknown) {
      message.error(requestErrorMessage(cause));

      if (requestStatusCode(cause) === 401) {
        await refreshNuxtData("portal-session");
      }
    } finally {
      pending.value = false;
    }
  }

  return { submit, pending };
}
