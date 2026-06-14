import { describe, expect, it, vi } from "vitest";
import {
  extractHtmlText,
  extractRecipeCandidate,
  extractRecipeFromAiResponse,
  extractRecipeJson,
  extractRecipeStructuredData,
  parseYouTubeVideoId,
  transcriptXmlToText,
} from "../src/lib/recipe-extraction";

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
    const recipe = extractRecipeJson(
      `結果です\n{"title":"味噌汁","ingredients":"味噌\\n豆腐","steps":"煮る","notes":"本文から抽出"}\n以上`,
    );

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

describe("extractRecipeStructuredData", () => {
  it("JSON-LDのRecipeから材料と手順を取り出す", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "Recipe",
          "name": "鶏肉のたっぷりしそ南蛮",
          "description": "鶏もも肉を野菜と一緒に南蛮漬けにします。",
          "recipeYield": "2人分",
          "recipeIngredient": ["鶏もも肉 1枚", "玉ねぎ 1/2個", "大葉 10枚"],
          "recipeInstructions": [
            {"@type": "HowToStep", "text": "玉ねぎは薄切りにする。"},
            {"@type": "HowToStep", "text": "鶏肉に片栗粉をまぶして焼く。"}
          ]
        }
      </script>
    `;

    expect(extractRecipeStructuredData(html)).toEqual({
      title: "鶏肉のたっぷりしそ南蛮",
      ingredients: "鶏もも肉 1枚\n玉ねぎ 1/2個\n大葉 10枚",
      steps: "玉ねぎは薄切りにする。\n鶏肉に片栗粉をまぶして焼く。",
      notes: "鶏もも肉を野菜と一緒に南蛮漬けにします。\n分量: 2人分",
    });
  });
});

describe("extractRecipeCandidate", () => {
  it("Delish KitchenのJSON-LDからAIレシピ候補を作る", async () => {
    const html = `
      <html><head><title>DELISH KITCHEN</title></head><body>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "Recipe",
          "name": "鶏肉のたっぷりしそ南蛮",
          "recipeIngredient": ["鶏もも肉 1枚", "大葉 10枚"],
          "recipeInstructions": [{"@type": "HowToStep", "text": "鶏肉を焼いて甘酢に漬ける。"}]
        }
      </script>
      </body></html>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html)),
    );
    const ai = {
      run: vi.fn(async () => ({
        response: {
          title: "鶏肉のたっぷりしそ南蛮",
          ingredients: "鶏もも肉 1枚\n大葉 10枚",
          steps: "鶏肉を焼いて甘酢に漬ける。",
          notes: "JSON-LDから抽出",
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
      "https://delishkitchen.tv/recipes/251841814468755862",
    );

    expect(candidate.title).toBe("鶏肉のたっぷりしそ南蛮");
    expect(candidate.ingredients).toContain("鶏もも肉");
    expect(candidate.steps).toContain("甘酢");
    expect(ai.run).not.toHaveBeenCalled();
  });

  it("YouTube next APIの説明欄から候補を作る", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://www.youtube.com/youtubei/v1/next") {
        return Response.json({
          contents: {
            twoColumnWatchNextResults: {
              results: {
                results: {
                  contents: [
                    { videoPrimaryInfoRenderer: { title: { runs: [{ text: "至高の唐揚げ" }] } } },
                    {
                      videoSecondaryInfoRenderer: {
                        attributedDescription: {
                          content: "鶏モモ肉、醤油、みりん、酒を使います。片栗粉をつけて揚げます。",
                        },
                      },
                    },
                  ],
                },
              },
            },
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
    const nextRequestInit = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const requestBody = JSON.parse(String(nextRequestInit?.body));

    expect(candidate.title).toBe("至高の唐揚げ");
    expect(candidate.ingredients).toContain("鶏モモ肉");
    expect(requestBody.context.client.hl).toBe("ja");
    expect(requestBody.context.client.gl).toBe("JP");
    expect(ai.run).toHaveBeenCalled();
  });

  it("英語メタデータでも日本語で出力するようAIに指示する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://www.youtube.com/youtubei/v1/next") {
          return Response.json({
            contents: {
              twoColumnWatchNextResults: {
                results: {
                  results: {
                    contents: [
                      { videoPrimaryInfoRenderer: { title: { runs: [{ text: "至高の唐揚げ" }] } } },
                      {
                        videoSecondaryInfoRenderer: {
                          attributedDescription: {
                            content: "鶏モモ肉、醤油、みりん、酒を使います。片栗粉をつけて揚げます。",
                          },
                        },
                      },
                    ],
                  },
                },
              },
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
      "https://youtu.be/xGKn7TD9jaM?si=LZ_RMaNhGK5xzcE7",
    );
    const aiInput = JSON.stringify((ai.run as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1]);

    expect(candidate.title).toBe("至高の唐揚げ");
    expect(candidate.ingredients).toContain("鶏モモ肉");
    expect(aiInput).toContain("必ずすべて自然な日本語");
    expect(aiInput).toContain("onion");
    expect(ai.run).toHaveBeenCalled();
  });

  it("AIの1回目の応答がJSONでなければ日本語JSONで再試行する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://www.youtube.com/youtubei/v1/next") {
          return Response.json({
            contents: {
              twoColumnWatchNextResults: {
                results: {
                  results: {
                    contents: [
                      { videoPrimaryInfoRenderer: { title: { runs: [{ text: "至高のハンバーグ" }] } } },
                      {
                        videoSecondaryInfoRenderer: {
                          attributedDescription: {
                            content: "牛豚合挽き肉 300g、玉ねぎ 1/2玉、卵 1個を使います。",
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );
    const ai = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ response: "Hamburger steak with onion and egg" })
        .mockResolvedValueOnce({
          response: {
            title: "至高のハンバーグ",
            ingredients: "牛豚合いびき肉 300g\n玉ねぎ 1/2玉\n卵 1個",
            steps: "",
            notes: "YouTube説明欄から抽出",
          },
        }),
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
      "https://youtu.be/qgL4wLgADUI?si=6HTrDsiXBfMj1lQ4",
    );

    expect(candidate.title).toBe("至高のハンバーグ");
    expect(candidate.ingredients).toContain("玉ねぎ");
    expect(ai.run).toHaveBeenCalledTimes(2);
  });

  it("YouTubeプレイヤー情報APIの最初の応答が空なら別クライアントで再試行する", async () => {
    let playerCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://www.youtube.com/youtubei/v1/next") {
        return new Response("not found", { status: 404 });
      }
      if (url === "https://www.youtube.com/youtubei/v1/player") {
        playerCalls += 1;
        if (playerCalls === 1) {
          return Response.json({ videoDetails: { title: "至高の唐揚げ", shortDescription: "" } });
        }
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(ai.run).toHaveBeenCalled();
  });

  it("YouTubeプレイヤー情報APIの説明欄から候補を作る", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://www.youtube.com/youtubei/v1/next") {
          return new Response("not found", { status: 404 });
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(youtubeHtml)),
    );
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
