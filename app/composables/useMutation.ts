export function useMutation() {
  const message = useMessage();
  const pending = ref(false);

  async function submit<T>(request: () => T) {
    if (pending.value) {
      return undefined;
    }

    pending.value = true;

    try {
      return await request();
    } catch (cause: any) {
      message.error(cause.data?.message ?? cause.message);

      if (cause.statusCode === 401) {
        await refreshNuxtData("portal-session");
      }

      return undefined;
    } finally {
      pending.value = false;
    }
  }

  return { submit, pending };
}
