export const formatDateTime = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
) =>
  new Date(value).toLocaleString("zh-CN", {
    ...options,
    timeZone: "Asia/Shanghai",
  });
