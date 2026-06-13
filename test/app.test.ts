import { describe, expect, it } from "vitest";
import app from "../src/index";

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
