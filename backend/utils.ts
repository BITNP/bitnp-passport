export const pick = <T extends object, K extends keyof T>(
  object: T,
  keys: readonly K[],
): Pick<T, K> =>
  Object.fromEntries(keys.map((key) => [key, object[key]])) as Pick<T, K>;
