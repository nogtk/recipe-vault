import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { recipeFormView } from "../src/views/recipes";

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
});

describe("recipeFormView", () => {
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
