import { describe, expect, it } from "vitest";
import { parseRecipeForm, parseTags, validateRecipeUrl } from "../src/lib/forms";

describe("parseTags", () => {
  it("カンマ区切りタグを整えて重複を除く", () => {
    expect(parseTags("和食, 作りたい,和食, 週末 ")).toEqual(["和食", "作りたい", "週末"]);
  });
});

describe("validateRecipeUrl", () => {
  it("httpとhttpsだけを許可する", () => {
    expect(validateRecipeUrl("https://example.com/a").ok).toBe(true);
    expect(validateRecipeUrl("ftp://example.com/a").ok).toBe(false);
    expect(validateRecipeUrl("not url").ok).toBe(false);
  });
});

describe("parseRecipeForm", () => {
  it("フォーム入力を保存用データへ正規化する", () => {
    const form = new FormData();
    form.set("url", "https://example.com/recipe");
    form.set("title", "  カレー  ");
    form.set("status", "made");
    form.set("tags", "夕飯, カレー");
    form.set("ingredients", "玉ねぎ");
    form.set("steps", "炒める");
    form.set("notes", "辛め");

    const result = parseRecipeForm(form);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        url: "https://example.com/recipe",
        title: "カレー",
        status: "made",
        tags: ["夕飯", "カレー"],
        ingredients: "玉ねぎ",
        steps: "炒める",
        notes: "辛め",
      });
    }
  });
});
