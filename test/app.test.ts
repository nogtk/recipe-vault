import { describe, expect, it } from "vitest";
import app from "../src/index";
import { recipeFormView } from "../src/views/recipes";

describe("app", () => {
  it("CSSを返す", async () => {
    const res = await app.request("/styles.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });

  it("未ログインではログイン画面へ移動する", async () => {
    const res = await app.request("/recipes/new", {}, { APP_PASSWORD: "secret" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("正しいパスワードでログインCookieを返す", async () => {
    const form = new FormData();
    form.set("password", "secret");

    const res = await app.request("/login", { method: "POST", body: form }, { APP_PASSWORD: "secret" });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.get("set-cookie")).toContain("recipe_session=");
  });

  it("ログイン済みなら新規レシピ画面を返す", async () => {
    const loginForm = new FormData();
    loginForm.set("password", "secret");
    const loginRes = await app.request("/login", { method: "POST", body: loginForm }, { APP_PASSWORD: "secret" });
    const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] ?? "";

    const res = await app.request("/recipes/new", { headers: { cookie } }, { APP_PASSWORD: "secret" });
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
