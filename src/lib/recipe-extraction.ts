import { extractTitleFromHtml, titleFromUrlFallback } from "./url-title";
import type { Env, RecipeInput } from "../types";

const defaultAiModel = "@cf/meta/llama-3.1-8b-instruct-fast";
const maxSourceChars = 24_000;
const maxPageHtmlChars = 200_000;
const maxYouTubeHtmlChars = 2_000_000;

type SourceText = {
  recipe?: Pick<RecipeCandidate, "title" | "ingredients" | "steps" | "notes">;
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

function arrayFromValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function hasRecipeType(value: unknown): boolean {
  const type = (value as { "@type"?: unknown })?.["@type"];
  return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
}

function collectJsonLdObjects(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const values = Array.isArray(value) ? value : Object.values(value);
  return [value, ...values.flatMap(collectJsonLdObjects)];
}

function textFromInstruction(value: unknown): string[] {
  if (typeof value === "string") return [normalizeText(value)].filter(Boolean);
  if (!value || typeof value !== "object") return [];

  const item = value as {
    itemListElement?: unknown;
    name?: unknown;
    text?: unknown;
  };
  const ownText = [item.name, item.text]
    .filter((text): text is string => typeof text === "string")
    .map(normalizeText)
    .filter(Boolean);
  return [...ownText, ...arrayFromValue(item.itemListElement).flatMap(textFromInstruction)];
}

export function extractRecipeStructuredData(html: string): Pick<RecipeCandidate, "title" | "ingredients" | "steps" | "notes"> | null {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeBasicEntities(script[1]));
      const recipe = collectJsonLdObjects(parsed).find(hasRecipeType) as
        | {
            description?: string;
            name?: string;
            recipeIngredient?: unknown;
            recipeInstructions?: unknown;
            recipeYield?: unknown;
          }
        | undefined;
      if (!recipe) continue;

      const ingredients = arrayFromValue(recipe.recipeIngredient).map((value) => normalizeText(String(value))).filter(Boolean);
      const steps = arrayFromValue(recipe.recipeInstructions).flatMap(textFromInstruction).filter(Boolean);
      const notes = [recipe.description, recipe.recipeYield ? `分量: ${String(recipe.recipeYield)}` : ""].map((value) => normalizeText(value ?? "")).filter(Boolean);

      if (ingredients.length || steps.length) {
        return {
          title: normalizeText(recipe.name ?? ""),
          ingredients: ingredients.join("\n"),
          steps: steps.join("\n"),
          notes: notes.join("\n"),
        };
      }
    } catch {
      continue;
    }
  }

  return null;
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

function extractJsonStringProperty(source: string, property: string): string | null {
  const marker = `"${property}":`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = source.indexOf("\"", markerIndex + marker.length);
  if (start === -1) return null;

  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      try {
        return JSON.parse(source.slice(start, index + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractYouTubeTitle(playerResponse: unknown): string | null {
  const videoDetails = (playerResponse as { videoDetails?: { title?: string } })?.videoDetails;
  return videoDetails?.title ?? null;
}

function readPath(value: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, value);
}

function textFromRuns(value: unknown): string | null {
  const runs = (value as { runs?: Array<{ text?: string }> })?.runs;
  const text = runs?.map((run) => run.text ?? "").join("").trim();
  return text || null;
}

function extractYouTubeNextTitle(nextResponse: unknown): string | null {
  return textFromRuns(readPath(nextResponse, ["contents", "twoColumnWatchNextResults", "results", "results", "contents", 0, "videoPrimaryInfoRenderer", "title"]));
}

function extractYouTubeNextDescription(nextResponse: unknown): string {
  const primaryDescription = readPath(nextResponse, [
    "contents",
    "twoColumnWatchNextResults",
    "results",
    "results",
    "contents",
    1,
    "videoSecondaryInfoRenderer",
    "attributedDescription",
    "content",
  ]);
  if (typeof primaryDescription === "string") return primaryDescription;

  const panels = (nextResponse as { engagementPanels?: unknown[] })?.engagementPanels ?? [];
  for (const panel of panels) {
    const items = readPath(panel, [
      "engagementPanelSectionListRenderer",
      "content",
      "structuredDescriptionContentRenderer",
      "items",
    ]);
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const description =
        readPath(item, ["expandableVideoDescriptionBodyRenderer", "attributedDescriptionBodyText", "content"]) ??
        readPath(item, ["expandableVideoDescriptionBodyRenderer", "colorSampledDescriptionBodyText", "content"]);
      if (typeof description === "string") return description;
    }
  }

  return "";
}

function extractCaptionUrl(playerResponse: unknown): string | null {
  const tracks = (playerResponse as {
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string }> } };
  })?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return tracks?.find((track) => track.languageCode === "ja")?.baseUrl ?? tracks?.[0]?.baseUrl ?? null;
}

async function fetchYouTubeNextSource(url: string, videoId: string): Promise<SourceText | null> {
  try {
    const response = await fetch("https://www.youtube.com/youtubei/v1/next", {
      method: "POST",
      headers: {
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240601.00.00",
          },
        },
      }),
    });
    if (!response.ok) return null;

    const nextResponse = await response.json();
    const title = extractYouTubeNextTitle(nextResponse) ?? titleFromUrlFallback(url);
    const text = extractYouTubeNextDescription(nextResponse).slice(0, maxSourceChars);
    if (!text) return null;

    return { title, url, text };
  } catch {
    return null;
  }
}

async function fetchYouTubePlayerSource(url: string, videoId: string): Promise<SourceText | null> {
  const clients = [
    { clientName: "WEB", clientVersion: "2.20240601.00.00" },
    { clientName: "MWEB", clientVersion: "2.20240601.00.00" },
    { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 30 },
  ];

  for (const client of clients) {
    try {
      const response = await fetch("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
        headers: {
          "accept-language": "ja,en-US;q=0.9,en;q=0.8",
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0",
        },
        body: JSON.stringify({
          videoId,
          context: {
            client,
          },
        }),
      });
      if (!response.ok) continue;

      const playerResponse = await response.json();
      const title = extractYouTubeTitle(playerResponse) ?? titleFromUrlFallback(url);
      const description = extractYouTubeDescription(playerResponse);
      const captionUrl = extractCaptionUrl(playerResponse);
      let transcript = "";

      if (captionUrl) {
        const captionResponse = await fetch(captionUrl);
        if (captionResponse.ok) transcript = transcriptXmlToText(await limitedText(captionResponse));
      }

      const text = [description, transcript].filter(Boolean).join("\n\n").slice(0, maxSourceChars);
      if (text) {
        return {
          title,
          url,
          text,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchYouTubeSource(url: string, html: string): Promise<SourceText> {
  const playerResponse = extractJsonObject(html, "ytInitialPlayerResponse") ?? {};
  const title = extractYouTubeTitle(playerResponse) ?? extractTitleFromHtml(html) ?? titleFromUrlFallback(url);
  const description = extractYouTubeDescription(playerResponse) || extractJsonStringProperty(html, "shortDescription") || "";
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
  const videoId = parseYouTubeVideoId(url);
  if (videoId) {
    const nextSource = await fetchYouTubeNextSource(url, videoId);
    if (nextSource?.text) return nextSource;

    const playerSource = await fetchYouTubePlayerSource(url, videoId);
    if (playerSource?.text) return playerSource;
  }

  const fetchUrl = videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=ja&gl=JP` : url;
  const response = await fetch(fetchUrl, {
    headers: {
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error("URLの内容を取得できませんでした。");

  const html = await limitedText(response, videoId ? maxYouTubeHtmlChars : maxPageHtmlChars);
  if (videoId) return fetchYouTubeSource(url, html);

  const structuredRecipe = extractRecipeStructuredData(html);
  if (structuredRecipe) {
    return {
      recipe: structuredRecipe,
      title: structuredRecipe.title || extractTitleFromHtml(html) || titleFromUrlFallback(url),
      url,
      text: [
        structuredRecipe.ingredients ? `材料:\n${structuredRecipe.ingredients}` : "",
        structuredRecipe.steps ? `手順:\n${structuredRecipe.steps}` : "",
        structuredRecipe.notes ? `メモ:\n${structuredRecipe.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, maxSourceChars),
    };
  }

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

function normalizeRecipeObject(value: unknown): Pick<RecipeCandidate, "title" | "ingredients" | "steps" | "notes"> | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<RecipeCandidate>;

  return {
    title: String(parsed.title ?? "").trim(),
    ingredients: String(parsed.ingredients ?? "").trim(),
    steps: String(parsed.steps ?? "").trim(),
    notes: String(parsed.notes ?? "").trim(),
  };
}

export function extractRecipeFromAiResponse(response: unknown): Pick<RecipeCandidate, "title" | "ingredients" | "steps" | "notes"> {
  if (typeof response === "string") return extractRecipeJson(response);
  if (!response || typeof response !== "object") throw new Error("AIの応答からJSONを読み取れませんでした。");

  const result = response as {
    response?: unknown;
    result?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const candidates = [
    result.response,
    result.result,
    result.choices?.[0]?.message?.content,
    response,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") return extractRecipeJson(candidate);
    const recipe = normalizeRecipeObject(candidate);
    if (recipe) return recipe;
  }

  throw new Error("AIの応答からJSONを読み取れませんでした。");
}

const recipeResponseFormat = {
  type: "json_schema",
  json_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      ingredients: { type: "string" },
      steps: { type: "string" },
      notes: { type: "string" },
    },
    required: ["title", "ingredients", "steps", "notes"],
  },
};

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
  if (source.recipe?.ingredients || source.recipe?.steps) {
    return {
      url,
      title: source.recipe.title || source.title,
      ingredients: source.recipe.ingredients,
      steps: source.recipe.steps,
      notes: source.recipe.notes,
    };
  }

  const response = await env.AI.run(env.AI_MODEL || defaultAiModel, {
    messages: [
      { role: "system", content: "あなたはレシピ本文を、保存用の日本語レシピ下書きに整えるアシスタントです。" },
      { role: "user", content: buildPrompt(source) },
    ],
    response_format: recipeResponseFormat,
  });
  const recipe = extractRecipeFromAiResponse(response);

  return {
    url,
    title: recipe.title || source.title,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
  };
}
