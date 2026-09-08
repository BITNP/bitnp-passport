import { NButton, NFlex } from "naive-ui";

import type { NuxtError } from "#app";

export function useFetchError(
  error: Ref<NuxtError | undefined>,
  retry: () => Promise<void>,
) {
  const message = useMessage();

  watch(
    error,
    (cause, _, onCleanup) => {
      if (!cause) {
        return;
      }

      const toast = message.error(
        () =>
          h(NFlex, { align: "center", size: 12 }, () => [
            h("span", (cause.data as any)?.message ?? cause.message),
            h(NButton, { text: true, onClick: retry }, () => "重试"),
          ]),
        { duration: 0 },
      );

      onCleanup(() => toast.destroy());
    },
    { immediate: true },
  );
}
