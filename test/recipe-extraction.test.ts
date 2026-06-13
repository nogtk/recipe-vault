import { describe, expect, it } from "vitest";
import { extractHtmlText, extractRecipeJson, parseYouTubeVideoId, transcriptXmlToText } from "../src/lib/recipe-extraction";

describe("extractHtmlText", () => {
  it("HTMLから本文らしいテキストを取り出す", () => {
    const html = `
      <html>
        <head><title>親子丼</title><style>.x{color:red}</style></head>
        <body><script>console.log("x")</script><h1>親子丼</h1><p>卵と鶏肉を使います。</p></body>
      </html>
    `;

    expect(extractHtmlText(html)).toContain("親子丼");
    expect(extractHtmlText(html)).toContain("卵と鶏肉を使います。");
    expect(extractHtmlText(html)).not.toContain("console.log");
  });
});

describe("parseYouTubeVideoId", () => {
  it("YouTube URLから動画IDを取り出す", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=abcdefghijk")).toBe("abcdefghijk");
    expect(parseYouTubeVideoId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
    expect(parseYouTubeVideoId("https://example.com/watch?v=abcdefghijk")).toBeNull();
  });
});

describe("transcriptXmlToText", () => {
  it("字幕XMLを読みやすいテキストにする", () => {
    const xml = `<transcript><text start="0">玉ねぎを切ります</text><text start="3">炒めます &amp; 煮ます</text></transcript>`;

    expect(transcriptXmlToText(xml)).toBe("玉ねぎを切ります\n炒めます & 煮ます");
  });
});

describe("extractRecipeJson", () => {
  it("AI出力に余計な文字があってもJSON部分を取り出す", () => {
    const recipe = extractRecipeJson(`結果です\n{"title":"味噌汁","ingredients":"味噌\\n豆腐","steps":"煮る","notes":"本文から抽出"}\n以上`);

    expect(recipe).toEqual({
      title: "味噌汁",
      ingredients: "味噌\n豆腐",
      steps: "煮る",
      notes: "本文から抽出",
    });
  });
});
