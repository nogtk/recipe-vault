import { describe, expect, it } from "vitest";
import { extractTitleFromHtml, titleFromUrlFallback } from "../src/lib/url-title";

describe("extractTitleFromHtml", () => {
  it("HTMLのtitle要素からタイトルを取り出す", () => {
    expect(extractTitleFromHtml("<html><head><title>  肉じゃが &amp; 味噌汁  </title></head></html>")).toBe(
      "肉じゃが & 味噌汁",
    );
  });

  it("titleがない場合はnullを返す", () => {
    expect(extractTitleFromHtml("<html><body>なし</body></html>")).toBeNull();
  });
});

describe("titleFromUrlFallback", () => {
  it("URLを仮タイトルにする", () => {
    expect(titleFromUrlFallback("https://example.com/recipe")).toBe("https://example.com/recipe");
  });
});
