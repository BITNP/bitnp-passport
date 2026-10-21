const maxAvatarUrlLength = 2048;

export function normalizeAvatarUrl(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") {
    return null;
  }

  const url = candidate.trim();
  if (!url || url.length > maxAvatarUrlLength) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !parsed.hostname
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return url;
}

export const avatarUrlFromAttributes = (
  attributes: Record<string, string[]> | null | undefined,
): string | null => normalizeAvatarUrl(attributes?.picture);

export function avatarInitials(name: string | null | undefined): string {
  const first = [...(name?.trim() ?? "")][0];

  return first?.toUpperCase() ?? "?";
}
