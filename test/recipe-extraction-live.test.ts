import { describe, expect, it, vi } from "vitest";
import { extractRecipeCandidate } from "../src/lib/recipe-extraction";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const liveUrls: string[] = (env.LIVE_RECIPE_URLS ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const describeLive = liveUrls.length ? describe : describe.skip;

describeLive("live recipe extraction smoke", () => {
  it.each(liveUrls)("実URLからレシピ候補の入口まで到達できる: %s", async (url) => {
    const ai = {
      run: vi.fn(async (_model: string, input: unknown) => {
        const request = input as { messages?: Array<{ role?: string; content?: string }> };
        const prompt = request.messages?.find((message) => message.role === "user")?.content ?? "";
        const sourceText = prompt.split("本文:\n")[1]?.trim() ?? "";

        expect(sourceText.length).toBeGreaterThanOrEqual(20);

        return {
          response: {
            title: "ライブ抽出チェック",
            ingredients: "抽出元本文あり",
            steps: "フォーム反映チェック",
            notes: "LIVE_RECIPE_URLSからのスモークテスト",
          },
        };
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
      url,
    );

    expect(candidate.url).toBe(url);
    expect(candidate.title).not.toBe("");
    expect(candidate.ingredients || candidate.steps).not.toBe("");
  });
});
