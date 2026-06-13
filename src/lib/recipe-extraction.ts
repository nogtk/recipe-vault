import { extractTitleFromHtml, titleFromUrlFallback } from "./url-title";
import type { Env, RecipeInput } from "../types";

const defaultAiModel = "@cf/qwen/qwen3-30b-a3b-fp8";
const maxSourceChars = 24_000;

type SourceText = {
  title: string;
  url: string;
  text: string;
};

export type RecipeCandidate = Pick<RecipeInput, "url" | "title" | "ingredients" | "steps" | "notes">;

function decodeBasicEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function normalizeText(value: string): string {
  return decodeBasicEntities(value).replace(/\s+/g, " ").trim();
}

async function limitedText(response: Response, maxChars = maxSourceChars): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, maxChars);

  const decoder = new TextDecoder();
  let output = "";
  while (output.length < maxChars) {
    const chunk = await reader.read();
    if (chunk.done) break;
    output += decoder.decode(chunk.value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return output.slice(0, maxChars);
}

export function extractHtmlText(html: string): string {
  return normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

export function parseYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.hostname === "www.youtube.com" || parsed.hostname === "youtube.com" || parsed.hostname === "m.youtube.com") {
      return parsed.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
}

export function transcriptXmlToText(xml: string): string {
  return [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((match) => normalizeText(match[1])).filter(Boolean).join("\n");
}

function extractJsonObject(source: string, marker: string): unknown | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = source.indexOf("{", markerIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(source.slice(start, index + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractYouTubeDescription(playerResponse: unknown): string {
  const videoDetails = (playerResponse as { videoDetails?: { shortDescription?: string } })?.videoDetails;
  return videoDetails?.shortDescription ?? "";
}

function extractYouTubeTitle(playerResponse: unknown): string | null {
  const videoDetails = (playerResponse as { videoDetails?: { title?: string } })?.videoDetails;
  return videoDetails?.title ?? null;
}

function extractCaptionUrl(playerResponse: unknown): string | null {
  const tracks = (playerResponse as {
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string }> } };
  })?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return tracks?.find((track) => track.languageCode === "ja")?.baseUrl ?? tracks?.[0]?.baseUrl ?? null;
}

async function fetchYouTubeSource(url: string, html: string): Promise<SourceText> {
  const playerResponse = extractJsonObject(html, "ytInitialPlayerResponse") ?? {};
  const title = extractYouTubeTitle(playerResponse) ?? extractTitleFromHtml(html) ?? titleFromUrlFallback(url);
  const description = extractYouTubeDescription(playerResponse);
  const captionUrl = extractCaptionUrl(playerResponse);
  let transcript = "";

  if (captionUrl) {
    const response = await fetch(captionUrl);
    if (response.ok) transcript = transcriptXmlToText(await limitedText(response));
  }

  return {
    title,
    url,
    text: [description, transcript].filter(Boolean).join("\n\n").slice(0, maxSourceChars),
  };
}

async function fetchSourceText(url: string): Promise<SourceText> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "recipe-vault/1.0",
    },
  });
  if (!response.ok) throw new Error("URLの内容を取得できませんでした。");

  const html = await limitedText(response);
  if (parseYouTubeVideoId(url)) return fetchYouTubeSource(url, html);

  return {
    title: extractTitleFromHtml(html) ?? titleFromUrlFallback(url),
    url,
    text: extractHtmlText(html).slice(0, maxSourceChars),
  };
}

export function extractRecipeJson(text: string): Pick<RecipeCandidate, "title" | "ingredients" | "steps" | "notes"> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AIの応答からJSONを読み取れませんでした。");
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<RecipeCandidate>;
  return {
    title: String(parsed.title ?? "").trim(),
    ingredients: String(parsed.ingredients ?? "").trim(),
    steps: String(parsed.steps ?? "").trim(),
    notes: String(parsed.notes ?? "").trim(),
  };
}

function buildPrompt(source: SourceText): string {
  return `次のテキストからレシピを抽出してください。本文にない材料、分量、手順は推測で補わないでください。
JSONだけを返してください。形式は {"title":"","ingredients":"","steps":"","notes":""} です。

URL: ${source.url}
候補タイトル: ${source.title}
本文:
${source.text}`;
}

export async function extractRecipeCandidate(env: Env, url: string): Promise<RecipeCandidate> {
  const source = await fetchSourceText(url);
  if (source.text.length < 20) {
    throw new Error("レシピ化できる本文や字幕が見つかりませんでした。");
  }

  const response = await env.AI.run(env.AI_MODEL || defaultAiModel, {
    messages: [
      { role: "system", content: "あなたはレシピ本文を、保存用の日本語レシピ下書きに整えるアシスタントです。" },
      { role: "user", content: buildPrompt(source) },
    ],
  });
  const text = typeof response === "string" ? response : String((response as { response?: string }).response ?? "");
  const recipe = extractRecipeJson(text);

  return {
    url,
    title: recipe.title || source.title,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
  };
}
