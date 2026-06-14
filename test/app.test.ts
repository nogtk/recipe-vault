import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { createSessionCookie } from "../src/lib/auth";
import { recipeFormView, recipeListView } from "../src/views/recipes";

const googleEnv = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  ALLOWED_EMAIL: "naoga.taka@gmail.com",
  SESSION_SECRET: "test-session-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("app", () => {
  it("CSSを返す", async () => {
    const res = await app.request("/styles.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });

  it("未ログインではGoogleログイン画面へ移動する", async () => {
    const res = await app.request("/recipes/new", {}, googleEnv);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("ログイン開始でGoogle認証URLへ移動する", async () => {
    const res = await app.request("/login", {}, googleEnv);
    const location = res.headers.get("location") ?? "";

    expect(res.status).toBe(302);
    expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("client_id=client-id");
    expect(location).toContain("scope=openid+email");
    expect(res.headers.get("set-cookie")).toContain("oauth_state=");
  });

  it("Googleコールバックで許可メールならログインCookieを返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return Response.json({ access_token: "access-token" });
        }
        if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
          return Response.json({ email: "naoga.taka@gmail.com", email_verified: true });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const res = await app.request("/auth/google/callback?code=abc&state=state-1", { headers: { cookie: "oauth_state=state-1" } }, googleEnv);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.get("set-cookie")).toContain("recipe_session=");
  });

  it("許可メールではないGoogleアカウントは拒否する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return Response.json({ access_token: "access-token" });
        }
        if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
          return Response.json({ email: "someone@example.com", email_verified: true });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const res = await app.request("/auth/google/callback?code=abc&state=state-1", { headers: { cookie: "oauth_state=state-1" } }, googleEnv);

    expect(res.status).toBe(403);
    expect(await res.text()).toContain("許可されていないGoogleアカウントです。");
  });

  it("ログイン済みなら新規レシピ画面を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return Response.json({ access_token: "access-token" });
        }
        if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
          return Response.json({ email: "naoga.taka@gmail.com", email_verified: true });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const loginRes = await app.request("/auth/google/callback?code=abc&state=state-1", { headers: { cookie: "oauth_state=state-1" } }, googleEnv);
    const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] ?? "";

    const res = await app.request("/recipes/new", { headers: { cookie } }, googleEnv);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("新規レシピ");
  });

  it("URLからAIレシピ候補を作って新規フォームに反映する", async () => {
    const cookie = (await createSessionCookie("naoga.taka@gmail.com", googleEnv.SESSION_SECRET)).split(";")[0];
    const form = new FormData();
    form.set("url", "https://example.com/recipe");
    const ai = {
      run: vi.fn(async () => ({
        response: JSON.stringify({
          title: "AI味噌汁",
          ingredients: "味噌\n豆腐",
          steps: "煮る",
          notes: "Webページから抽出",
        }),
      })),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html><head><title>味噌汁</title></head><body><p>味噌と豆腐を煮ます。だしを温め、豆腐を入れて、最後に味噌を溶きます。</p></body></html>", { headers: { "content-type": "text/html" } })),
    );

    const res = await app.request("/recipes/extract", { method: "POST", headers: { cookie }, body: form }, { ...googleEnv, AI: ai });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("AI味噌汁");
    expect(html).toContain("味噌");
    expect(html).toContain("Webページから抽出");
    expect(ai.run).toHaveBeenCalled();
  });
});

describe("recipeFormView", () => {
  it("新規レシピではURL入力のフォーカスアウトでAI候補作成を自動実行する", () => {
    const html = recipeFormView({
      title: "新規レシピ",
      action: "/recipes",
    });

    expect(html).toContain('data-auto-extract-form="true"');
    expect(html).toContain('data-auto-extract-url="true"');
    expect(html).toContain('data-loading-label="AIで候補を作成中"');
    expect(html).toContain('addEventListener("blur"');
    expect(html).toContain('form.requestSubmit(extractButton)');
  });

  it("既存レシピでは元URLリンクと削除フォームを表示する", () => {
    const html = recipeFormView({
      title: "レシピ編集",
      action: "/recipes/abc",
      recipe: {
        id: "abc",
        url: "https://example.com/r",
        title: "味噌汁",
        status: "made",
        tags: ["和食"],
        ingredients: "味噌",
        steps: "煮る",
        notes: "",
      },
    });

    expect(html).toContain("https://example.com/r");
    expect(html).toContain("/recipes/abc/delete");
  });
});

describe("recipeListView", () => {
  it("一覧カードに材料と手順の抜粋を表示する", () => {
    const html = recipeListView(
      [
        {
          id: "abc",
          url: "https://example.com/r",
          title: "唐揚げ",
          status: "want_to_make",
          tags: ["揚げ物"],
          ingredients: "鶏モモ肉\n醤油\nみりん",
          steps: "下味をつけて片栗粉をまぶし、中温で揚げる",
          notes: "",
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      ],
      {},
    );

    expect(html).toContain("材料");
    expect(html).toContain("鶏モモ肉");
    expect(html).toContain("手順");
    expect(html).toContain("中温で揚げる");
    expect(html).toContain("元サイトを開く");
    expect(html).toContain('href="https://example.com/r"');
    expect(html).toContain('target="_blank"');
  });
});
