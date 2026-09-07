export const pick = <T extends object, K extends keyof T>(
  object: T,
  keys: readonly K[],
): Pick<T, K> =>
  Object.fromEntries(keys.map((key) => [key, object[key]])) as Pick<T, K>;

// Share concurrent calls and optionally cache successful results
export function createSharedAsync<T>(
  load: () => Promise<T>,
  { cacheResult = true }: { cacheResult?: boolean } = {},
) {
  let current: Promise<T> | undefined;

  return () => {
    current ??= load().then(
      (value) => {
        if (!cacheResult) {
          current = undefined;
        }

        return value;
      },
      (error: unknown) => {
        current = undefined;

        throw error;
      },
    );

    return current;
  };
}
