export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
