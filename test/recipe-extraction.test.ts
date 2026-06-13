import { describe, expect, it, vi } from "vitest";
import { extractHtmlText, extractRecipeCandidate, extractRecipeFromAiResponse, extractRecipeJson, parseYouTubeVideoId, transcriptXmlToText } from "../src/lib/recipe-extraction";

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

describe("extractRecipeFromAiResponse", () => {
  it("Workers AI JSON Modeのオブジェクト応答を読み取る", () => {
    expect(
      extractRecipeFromAiResponse({
        response: {
          title: "唐揚げ",
          ingredients: "鶏モモ肉",
          steps: "揚げる",
          notes: "説明欄から抽出",
        },
      }),
    ).toEqual({
      title: "唐揚げ",
      ingredients: "鶏モモ肉",
      steps: "揚げる",
      notes: "説明欄から抽出",
    });
  });
});

describe("extractRecipeCandidate", () => {
  it("YouTubeプレイヤー情報APIの最初の応答が空なら別クライアントで再試行する", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://www.youtube.com/youtubei/v1/player" && fetchMock.mock.calls.length === 1) {
        return Response.json({ videoDetails: { title: "至高の唐揚げ", shortDescription: "" } });
      }
      if (url === "https://www.youtube.com/youtubei/v1/player") {
        return Response.json({
          videoDetails: {
            title: "至高の唐揚げ",
            shortDescription: "鶏モモ肉、醤油、みりん、酒を使います。片栗粉をつけて揚げます。",
          },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const ai = {
      run: vi.fn(async () => ({
        response: {
          title: "至高の唐揚げ",
          ingredients: "鶏モモ肉\n醤油\nみりん\n酒\n片栗粉",
          steps: "下味をつけて片栗粉をつけて揚げる",
          notes: "YouTube説明欄から抽出",
        },
      })),
    };

    const candidate = await extractRecipeCandidate(
      {
        AI: ai,
        DB: {} as D1Database,
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        ALLOWED_EMAIL: "",
        SESSION_SECRET: "",
      },
      "https://youtu.be/xGKn7TD9jaM?si=LZ_RMaNhGK5xzcE7",
    );

    expect(candidate.title).toBe("至高の唐揚げ");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ai.run).toHaveBeenCalled();
  });

  it("YouTubeプレイヤー情報APIの説明欄から候補を作る", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://www.youtube.com/youtubei/v1/player") {
          return Response.json({
            videoDetails: {
              title: "至高の唐揚げ",
              shortDescription: "鶏モモ肉、醤油、みりん、酒を使います。片栗粉をつけて揚げます。",
            },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );
    const ai = {
      run: vi.fn(async () => ({
        response: {
          title: "至高の唐揚げ",
          ingredients: "鶏モモ肉\n醤油\nみりん\n酒\n片栗粉",
          steps: "下味をつけて片栗粉をつけて揚げる",
          notes: "YouTube説明欄から抽出",
        },
      })),
    };

    const candidate = await extractRecipeCandidate(
      {
        AI: ai,
        DB: {} as D1Database,
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        ALLOWED_EMAIL: "",
        SESSION_SECRET: "",
      },
      "https://youtu.be/xGKn7TD9jaM?si=9dv-TX8EqunNL0-o",
    );

    expect(candidate.title).toBe("至高の唐揚げ");
    expect(candidate.steps).toContain("揚げる");
    expect(ai.run).toHaveBeenCalled();
  });

  it("YouTube情報がHTMLの後方にあっても説明欄を使って候補を作る", async () => {
    const longPadding = "x".repeat(30_000);
    const youtubeHtml = `${longPadding}<script>var ytInitialPlayerResponse = {"videoDetails":{"title":"至高の唐揚げ","shortDescription":"鶏モモ肉、醤油、みりん、酒を使います。揚げます。"}};</script>`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(youtubeHtml)));
    const ai = {
      run: vi.fn(async () => ({
        response: {
          title: "至高の唐揚げ",
          ingredients: "鶏モモ肉\n醤油\nみりん\n酒",
          steps: "下味をつけて揚げる",
          notes: "YouTube説明欄から抽出",
        },
      })),
    };

    const candidate = await extractRecipeCandidate(
      {
        AI: ai,
        DB: {} as D1Database,
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        ALLOWED_EMAIL: "",
        SESSION_SECRET: "",
      },
      "https://youtu.be/xGKn7TD9jaM?si=9dv-TX8EqunNL0-o",
    );

    expect(candidate.title).toBe("至高の唐揚げ");
    expect(candidate.ingredients).toContain("鶏モモ肉");
    expect(ai.run).toHaveBeenCalled();
  });
});
