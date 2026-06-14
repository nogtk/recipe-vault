import type { RecipeInput, RecipeStatus } from "../types";

type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const statuses: RecipeStatus[] = ["want_to_make", "made"];
const statusSet = new Set<RecipeStatus>(statuses);

export function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

export function validateRecipeUrl(value: string): ParseResult<string> {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, errors: ["URLはhttpまたはhttpsで始まる必要があります。"] };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, errors: ["URLの形式が正しくありません。"] };
  }
}

export function parseRecipeForm(form: FormData): ParseResult<RecipeInput> {
  const errors: string[] = [];
  const urlResult = validateRecipeUrl(String(form.get("url") ?? ""));
  const status = String(form.get("status") || "want_to_make") as RecipeStatus;

  if (!urlResult.ok) errors.push(...urlResult.errors);
  if (!statusSet.has(status)) errors.push("ステータスの値が正しくありません。");

  const title = String(form.get("title") ?? "").trim();

  if (errors.length > 0 || !urlResult.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      url: urlResult.value,
      title,
      status,
      tags: parseTags(String(form.get("tags") ?? "")),
      ingredients: String(form.get("ingredients") ?? "").trim(),
      steps: String(form.get("steps") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    },
  };
}
