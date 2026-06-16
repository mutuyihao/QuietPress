export const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_LOCALE || "zh-CN";

export function formatDateTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = "未知时间",
): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(
    new Date(value),
  );
}
