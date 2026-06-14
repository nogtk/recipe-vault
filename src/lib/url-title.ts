const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeBasicEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot);|&#39;/g, (match) => entities[match] ?? match);
}

export function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? decodeBasicEntities(match[1].replace(/\s+/g, " ").trim()) : "";
  return title || null;
}

export function titleFromUrlFallback(url: string): string {
  return url;
}

export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "recipe-vault/1.0",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    const html = await response.text();
    return extractTitleFromHtml(html);
  } catch (error) {
    console.warn(JSON.stringify({ message: "タイトル取得に失敗しました。", url, error: String(error) }));
    return null;
  }
}
