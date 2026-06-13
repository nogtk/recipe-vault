import { describe, expect, it } from "vitest";
import app from "../src/index";
import { recipeFormView } from "../src/views/recipes";

describe("app", () => {
  it("CSSを返す", async () => {
    const res = await app.request("/styles.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });

  it("新規レシピ画面を返す", async () => {
    const res = await app.request("/recipes/new");
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
