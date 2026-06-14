# レシピ保存アプリ実装計画

> **エージェント作業者向け:** 必須サブスキル: この計画をタスクごとに実装する場合は、superpowers:subagent-driven-development（推奨）またはsuperpowers:executing-plansを使う。進捗管理にはチェックボックス（`- [ ]`）を使う。

**目的:** Hono + Cloudflare Workers + D1で、本人だけがCloudflare Access経由で使うレシピ保存Webアプリの初期版を作る。

**アーキテクチャ:** Honoでサーバー生成HTMLを返し、D1にレシピを保存する。フォーム入力は小さなヘルパーで正規化し、DB操作とHTML表示を分離する。Cloudflare Accessはアプリ外で設定し、アプリ内にはGoogle OAuthを持たせない。

**技術スタック:** TypeScript、Hono、Cloudflare Workers、Cloudflare D1、Wrangler、Vitest

---

## ファイル構成

- 作成: `package.json`。npm scriptsと依存関係を定義する。
- 作成: `tsconfig.json`。Workers向けTypeScript設定を定義する。
- 作成: `vitest.config.ts`。単体テスト設定を定義する。
- 作成: `wrangler.jsonc`。Worker、D1、observability、compatibility dateを定義する。
- 作成: `migrations/0001_create_recipes.sql`。D1テーブルとインデックスを作る。
- 作成: `src/index.ts`。Honoアプリを作り、ルートを登録する。
- 作成: `src/types.ts`。D1バインディングとレシピ型を定義する。
- 作成: `src/db/recipes.ts`。D1クエリとDB行の変換を担当する。
- 作成: `src/lib/forms.ts`。フォーム入力の正規化とバリデーションを担当する。
- 作成: `src/lib/url-title.ts`。URL先HTMLからタイトルを抽出する。
- 作成: `src/lib/html.ts`。HTMLエスケープなど表示用の補助関数を置く。
- 作成: `src/routes/recipes.ts`。レシピCRUDのルートを定義する。
- 作成: `src/views/layout.ts`。共通レイアウトを返す。
- 作成: `src/views/recipes.ts`。一覧、フォーム、エラー画面を返す。
- 作成: `src/styles.ts`。画面全体のCSSを返す。
- 作成: `test/forms.test.ts`。フォーム正規化の単体テスト。
- 作成: `test/url-title.test.ts`。HTMLタイトル抽出の単体テスト。
- 作成: `test/app.test.ts`。主要ルートのスモークテスト。

## タスク 1: プロジェクト設定と依存関係

**対象ファイル:**

- 作成: `package.json`
- 作成: `tsconfig.json`
- 作成: `vitest.config.ts`
- 作成: `wrangler.jsonc`

- [ ] **ステップ 1: `package.json`を作成する**

```json
{
  "name": "recipe-vault",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && npm run test"
  },
  "dependencies": {
    "hono": "^4.8.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260613.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0",
    "wrangler": "^4.20.0"
  }
}
```

- [ ] **ステップ 2: TypeScript設定を作成する**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types", "vitest/globals"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

- [ ] **ステップ 3: Vitest設定を作成する**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **ステップ 4: Wrangler設定を作成する**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "recipe-vault",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-13",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "recipe-vault",
      "database_id": "00000000-0000-0000-0000-000000000000",
    },
  ],
}
```

`database_id`は実際に `wrangler d1 create recipe-vault` を実行した後で差し替える。

- [ ] **ステップ 5: 依存関係をインストールする**

実行: `npm install`

期待結果: `package-lock.json` と `node_modules` が作成される。

- [ ] **ステップ 6: 型チェックがまだ失敗することを確認する**

実行: `npm run typecheck`

期待結果: `src/index.ts` が存在しないため失敗する。

- [ ] **ステップ 7: コミットする**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts wrangler.jsonc
git commit -m "chore: Hono Workersプロジェクトを設定する"
```

## タスク 2: DBスキーマと型定義

**対象ファイル:**

- 作成: `migrations/0001_create_recipes.sql`
- 作成: `src/types.ts`
- 作成: `src/db/recipes.ts`
- テスト: `test/forms.test.ts`
- 作成: `src/lib/forms.ts`

- [ ] **ステップ 1: フォーム正規化の失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { parseRecipeForm, parseTags, validateRecipeUrl } from "../src/lib/forms";

describe("parseTags", () => {
  it("カンマ区切りタグを整えて重複を除く", () => {
    expect(parseTags("和食, 作りたい,和食, 週末 ")).toEqual(["和食", "作りたい", "週末"]);
  });
});

describe("validateRecipeUrl", () => {
  it("httpとhttpsだけを許可する", () => {
    expect(validateRecipeUrl("https://example.com/a").ok).toBe(true);
    expect(validateRecipeUrl("ftp://example.com/a").ok).toBe(false);
    expect(validateRecipeUrl("not url").ok).toBe(false);
  });
});

describe("parseRecipeForm", () => {
  it("フォーム入力を保存用データへ正規化する", () => {
    const form = new FormData();
    form.set("url", "https://example.com/recipe");
    form.set("title", "  カレー  ");
    form.set("status", "made");
    form.set("tags", "夕飯, カレー");
    form.set("ingredients", "玉ねぎ");
    form.set("steps", "炒める");
    form.set("notes", "辛め");

    const result = parseRecipeForm(form);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        url: "https://example.com/recipe",
        title: "カレー",
        status: "made",
        tags: ["夕飯", "カレー"],
        ingredients: "玉ねぎ",
        steps: "炒める",
        notes: "辛め",
      });
    }
  });
});
```

- [ ] **ステップ 2: テスト失敗を確認する**

実行: `npm test -- test/forms.test.ts`

期待結果: `src/lib/forms` が存在しないため失敗する。

- [ ] **ステップ 3: D1マイグレーションを作成する**

```sql
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('want_to_make', 'made')),
  tags TEXT NOT NULL DEFAULT '[]',
  ingredients TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_recipes_updated_at ON recipes(updated_at);
CREATE INDEX idx_recipes_status ON recipes(status);
```

- [ ] **ステップ 4: 共通型を作成する**

```ts
export type Env = {
  DB: D1Database;
};

export type RecipeStatus = "want_to_make" | "made";

export type Recipe = {
  id: string;
  url: string;
  title: string;
  status: RecipeStatus;
  tags: string[];
  ingredients: string;
  steps: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeInput = {
  url: string;
  title: string;
  status: RecipeStatus;
  tags: string[];
  ingredients: string;
  steps: string;
  notes: string;
};
```

- [ ] **ステップ 5: フォームヘルパーを実装する**

```ts
import type { RecipeInput, RecipeStatus } from "../types";

type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const statuses: RecipeStatus[] = ["want_to_make", "made"];

export function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function validateRecipeUrl(value: string): ParseResult<string> {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, errors: ["URLはhttpまたはhttpsで始まる必要があります。"] };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, errors: ["URLの形式が正しくありません。"] };
  }
}

export function parseRecipeForm(form: FormData): ParseResult<RecipeInput> {
  const errors: string[] = [];
  const urlResult = validateRecipeUrl(String(form.get("url") ?? ""));
  const status = String(form.get("status") || "want_to_make") as RecipeStatus;

  if (!urlResult.ok) errors.push(...urlResult.errors);
  if (!statuses.includes(status)) errors.push("ステータスの値が正しくありません。");

  const title = String(form.get("title") ?? "").trim();

  if (errors.length > 0 || !urlResult.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      url: urlResult.value,
      title,
      status,
      tags: parseTags(String(form.get("tags") ?? "")),
      ingredients: String(form.get("ingredients") ?? "").trim(),
      steps: String(form.get("steps") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    },
  };
}
```

- [ ] **ステップ 6: DB操作を実装する**

```ts
import type { Recipe, RecipeInput } from "../types";

type RecipeRow = {
  id: string;
  url: string;
  title: string;
  status: Recipe["status"];
  tags: string;
  ingredients: string;
  steps: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type ListFilters = {
  query?: string;
  status?: Recipe["status"];
  tag?: string;
};

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    status: row.status,
    tags: JSON.parse(row.tags) as string[],
    ingredients: row.ingredients,
    steps: row.steps,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRecipes(db: D1Database, filters: ListFilters): Promise<Recipe[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }

  if (filters.query) {
    where.push("(title LIKE ? OR url LIKE ? OR tags LIKE ? OR ingredients LIKE ? OR steps LIKE ? OR notes LIKE ?)");
    const q = `%${filters.query}%`;
    params.push(q, q, q, q, q, q);
  }

  if (filters.tag) {
    where.push("tags LIKE ?");
    params.push(`%\"${filters.tag}\"%`);
  }

  const sql = `SELECT * FROM recipes ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC`;
  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<RecipeRow>();
  return result.results.map(toRecipe);
}

export async function getRecipe(db: D1Database, id: string): Promise<Recipe | null> {
  const row = await db.prepare("SELECT * FROM recipes WHERE id = ?").bind(id).first<RecipeRow>();
  return row ? toRecipe(row) : null;
}

export async function createRecipe(db: D1Database, input: RecipeInput): Promise<Recipe> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO recipes (id, url, title, status, tags, ingredients, steps, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      input.url,
      input.title,
      input.status,
      JSON.stringify(input.tags),
      input.ingredients,
      input.steps,
      input.notes,
      now,
      now,
    )
    .run();
  const recipe = await getRecipe(db, id);
  if (!recipe) throw new Error("作成したレシピを読み込めませんでした。");
  return recipe;
}

export async function updateRecipe(db: D1Database, id: string, input: RecipeInput): Promise<void> {
  await db
    .prepare(
      "UPDATE recipes SET url = ?, title = ?, status = ?, tags = ?, ingredients = ?, steps = ?, notes = ?, updated_at = ? WHERE id = ?",
    )
    .bind(
      input.url,
      input.title,
      input.status,
      JSON.stringify(input.tags),
      input.ingredients,
      input.steps,
      input.notes,
      new Date().toISOString(),
      id,
    )
    .run();
}

export async function deleteRecipe(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM recipes WHERE id = ?").bind(id).run();
}
```

- [ ] **ステップ 7: テスト成功を確認する**

実行: `npm test -- test/forms.test.ts`

期待結果: `3 passed`

- [ ] **ステップ 8: コミットする**

```bash
git add migrations/0001_create_recipes.sql src/types.ts src/db/recipes.ts src/lib/forms.ts test/forms.test.ts
git commit -m "feat: レシピ保存用のDB層を追加する"
```

## タスク 3: URLタイトル取得

**対象ファイル:**

- 作成: `src/lib/url-title.ts`
- テスト: `test/url-title.test.ts`

- [ ] **ステップ 1: タイトル抽出の失敗テストを書く**

```ts
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
```

- [ ] **ステップ 2: テスト失敗を確認する**

実行: `npm test -- test/url-title.test.ts`

期待結果: `src/lib/url-title` が存在しないため失敗する。

- [ ] **ステップ 3: タイトル取得ヘルパーを実装する**

```ts
const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeBasicEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot);|&#39;/g, (match) => entities[match] ?? match);
}

export function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? decodeBasicEntities(match[1].replace(/\s+/g, " ").trim()) : "";
  return title || null;
}

export function titleFromUrlFallback(url: string): string {
  return url;
}

export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "recipe-vault/1.0",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    const html = await response.text();
    return extractTitleFromHtml(html);
  } catch (error) {
    console.warn(JSON.stringify({ message: "タイトル取得に失敗しました。", url, error: String(error) }));
    return null;
  }
}
```

- [ ] **ステップ 4: テスト成功を確認する**

実行: `npm test -- test/url-title.test.ts`

期待結果: `3 passed`

- [ ] **ステップ 5: コミットする**

```bash
git add src/lib/url-title.ts test/url-title.test.ts
git commit -m "feat: URL先のタイトル抽出を追加する"
```

## タスク 4: HTML表示とHonoルート

**対象ファイル:**

- 作成: `src/lib/html.ts`
- 作成: `src/styles.ts`
- 作成: `src/views/layout.ts`
- 作成: `src/views/recipes.ts`
- 作成: `src/routes/recipes.ts`
- 作成: `src/index.ts`
- テスト: `test/app.test.ts`

- [ ] **ステップ 1: ルートの失敗テストを書く**

```ts
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
```

- [ ] **ステップ 2: テスト失敗を確認する**

実行: `npm test -- test/app.test.ts`

期待結果: `src/index` が存在しないため失敗する。

- [ ] **ステップ 3: HTML補助関数を作成する**

```ts
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
```

- [ ] **ステップ 4: CSSを作成する**

```ts
export const styles = `
:root {
  color-scheme: light;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f7f5ef;
  color: #25231f;
}
body { margin: 0; }
a { color: #235c8f; }
.shell { max-width: 1040px; margin: 0 auto; padding: 28px 18px 48px; }
.topbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 24px; }
.topbar h1 { font-size: 28px; margin: 0; }
.button, button {
  border: 1px solid #2f5d50;
  background: #2f5d50;
  color: #fff;
  border-radius: 6px;
  padding: 9px 13px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.button.secondary { background: #fff; color: #2f5d50; }
.filters, .form, .recipe-list { display: grid; gap: 12px; }
.filters { grid-template-columns: 1fr 170px 170px auto; align-items: end; margin-bottom: 20px; }
label { display: grid; gap: 6px; font-weight: 600; }
input, select, textarea {
  border: 1px solid #c8c1b4;
  border-radius: 6px;
  padding: 9px 10px;
  font: inherit;
  background: #fff;
  color: inherit;
}
textarea { min-height: 110px; resize: vertical; }
.recipe-card {
  background: #fff;
  border: 1px solid #ded7ca;
  border-radius: 8px;
  padding: 16px;
}
.recipe-card h2 { font-size: 19px; margin: 0 0 8px; }
.meta { color: #665f54; font-size: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.tag { background: #e8f0eb; color: #29483e; border-radius: 999px; padding: 3px 8px; font-size: 13px; }
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
.error { border: 1px solid #b64b3a; background: #fff1ed; color: #7d2d20; border-radius: 6px; padding: 10px; }
@media (max-width: 760px) {
  .topbar, .filters { grid-template-columns: 1fr; display: grid; align-items: stretch; }
}
`;
```

- [ ] **ステップ 5: レイアウトと画面を作成する**

```ts
import { escapeHtml } from "../lib/html";

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | レシピ保存</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="shell">${body}</main>
</body>
</html>`;
}
```

```ts
import type { Recipe, RecipeInput, RecipeStatus } from "../types";
import { escapeHtml, hostFromUrl } from "../lib/html";
import { layout } from "./layout";

const statusLabels: Record<RecipeStatus, string> = {
  want_to_make: "作りたい",
  made: "作った",
};

export function recipeListView(recipes: Recipe[], filters: { query?: string; status?: string; tag?: string }): string {
  const cards = recipes
    .map(
      (recipe) => `
    <article class="recipe-card">
      <h2><a href="/recipes/${escapeHtml(recipe.id)}">${escapeHtml(recipe.title)}</a></h2>
      <div class="meta"><span>${statusLabels[recipe.status]}</span><span>${escapeHtml(hostFromUrl(recipe.url))}</span></div>
      ${recipe.notes ? `<p>${escapeHtml(recipe.notes.slice(0, 120))}</p>` : ""}
      <div class="tags">${recipe.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `,
    )
    .join("");

  return layout(
    "レシピ一覧",
    `
    <div class="topbar"><h1>レシピ保存</h1><a class="button" href="/recipes/new">新規レシピ</a></div>
    <form class="filters" method="get" action="/">
      <label>検索<input name="q" value="${escapeHtml(filters.query ?? "")}"></label>
      <label>ステータス<select name="status">
        <option value="">すべて</option>
        <option value="want_to_make" ${filters.status === "want_to_make" ? "selected" : ""}>作りたい</option>
        <option value="made" ${filters.status === "made" ? "selected" : ""}>作った</option>
      </select></label>
      <label>タグ<input name="tag" value="${escapeHtml(filters.tag ?? "")}"></label>
      <button type="submit">絞り込む</button>
    </form>
    <section class="recipe-list">${cards || "<p>まだレシピがありません。</p>"}</section>
  `,
  );
}

export function recipeFormView(options: {
  title: string;
  action: string;
  recipe?: Partial<RecipeInput> & { id?: string };
  errors?: string[];
}): string {
  const recipe = options.recipe ?? {};
  return layout(
    options.title,
    `
    <div class="topbar"><h1>${escapeHtml(options.title)}</h1><a class="button secondary" href="/">一覧へ</a></div>
    ${options.errors?.length ? `<div class="error">${options.errors.map(escapeHtml).join("<br>")}</div>` : ""}
    <form class="form" method="post" action="${escapeHtml(options.action)}">
      <label>URL<input required name="url" value="${escapeHtml(recipe.url ?? "")}"></label>
      <label>タイトル<input name="title" value="${escapeHtml(recipe.title ?? "")}"></label>
      <label>ステータス<select name="status">
        <option value="want_to_make" ${recipe.status !== "made" ? "selected" : ""}>作りたい</option>
        <option value="made" ${recipe.status === "made" ? "selected" : ""}>作った</option>
      </select></label>
      <label>タグ<input name="tags" value="${escapeHtml(recipe.tags?.join(", ") ?? "")}"></label>
      <label>材料<textarea name="ingredients">${escapeHtml(recipe.ingredients ?? "")}</textarea></label>
      <label>手順<textarea name="steps">${escapeHtml(recipe.steps ?? "")}</textarea></label>
      <label>メモ<textarea name="notes">${escapeHtml(recipe.notes ?? "")}</textarea></label>
      <div class="actions"><button type="submit">保存する</button></div>
    </form>
  `,
  );
}
```

- [ ] **ステップ 6: ルートを作成する**

```ts
import { Hono } from "hono";
import { createRecipe, deleteRecipe, getRecipe, listRecipes, updateRecipe } from "../db/recipes";
import { parseRecipeForm } from "../lib/forms";
import { fetchPageTitle, titleFromUrlFallback } from "../lib/url-title";
import type { Env, RecipeStatus } from "../types";
import { recipeFormView, recipeListView } from "../views/recipes";

export const recipeRoutes = new Hono<{ Bindings: Env }>();

recipeRoutes.get("/", async (c) => {
  const query = c.req.query("q")?.trim() || undefined;
  const tag = c.req.query("tag")?.trim() || undefined;
  const status = c.req.query("status") as RecipeStatus | undefined;
  const recipes = await listRecipes(c.env.DB, { query, tag, status });
  return c.html(recipeListView(recipes, { query, tag, status }));
});

recipeRoutes.get("/recipes/new", (c) => {
  return c.html(recipeFormView({ title: "新規レシピ", action: "/recipes" }));
});

recipeRoutes.post("/recipes", async (c) => {
  const result = parseRecipeForm(await c.req.formData());
  if (!result.ok) {
    return c.html(recipeFormView({ title: "新規レシピ", action: "/recipes", errors: result.errors }), 400);
  }
  const title =
    result.value.title || (await fetchPageTitle(result.value.url)) || titleFromUrlFallback(result.value.url);
  const recipe = await createRecipe(c.env.DB, { ...result.value, title });
  return c.redirect(`/recipes/${recipe.id}`);
});

recipeRoutes.get("/recipes/:id", async (c) => {
  const recipe = await getRecipe(c.env.DB, c.req.param("id"));
  if (!recipe) return c.notFound();
  return c.html(recipeFormView({ title: "レシピ編集", action: `/recipes/${recipe.id}`, recipe }));
});

recipeRoutes.post("/recipes/:id", async (c) => {
  const id = c.req.param("id");
  const result = parseRecipeForm(await c.req.formData());
  if (!result.ok) {
    return c.html(recipeFormView({ title: "レシピ編集", action: `/recipes/${id}`, errors: result.errors }), 400);
  }
  const title = result.value.title || titleFromUrlFallback(result.value.url);
  await updateRecipe(c.env.DB, id, { ...result.value, title });
  return c.redirect(`/recipes/${id}`);
});

recipeRoutes.post("/recipes/:id/delete", async (c) => {
  await deleteRecipe(c.env.DB, c.req.param("id"));
  return c.redirect("/");
});
```

- [ ] **ステップ 7: アプリ入口を作成する**

```ts
import { Hono } from "hono";
import { recipeRoutes } from "./routes/recipes";
import { styles } from "./styles";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/styles.css", (c) => {
  return c.text(styles, 200, { "content-type": "text/css; charset=utf-8" });
});

app.route("/", recipeRoutes);

app.notFound((c) => c.text("見つかりませんでした。", 404));

export default app;
```

- [ ] **ステップ 8: テスト成功を確認する**

実行: `npm test -- test/app.test.ts`

期待結果: `2 passed`

- [ ] **ステップ 9: コミットする**

```bash
git add src/lib/html.ts src/styles.ts src/views/layout.ts src/views/recipes.ts src/routes/recipes.ts src/index.ts test/app.test.ts
git commit -m "feat: レシピ画面とルートを追加する"
```

## タスク 5: 削除操作と詳細画面の仕上げ

**対象ファイル:**

- 変更: `src/views/recipes.ts`
- 変更: `test/app.test.ts`

- [ ] **ステップ 1: 編集画面に削除フォームが必要なテストを書く**

```ts
import { describe, expect, it } from "vitest";
import { recipeFormView } from "../src/views/recipes";

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
```

- [ ] **ステップ 2: テスト失敗を確認する**

実行: `npm test -- test/app.test.ts`

期待結果: 削除フォームがまだないため失敗する。

- [ ] **ステップ 3: 詳細画面に元URLリンクと削除フォームを追加する**

`recipeFormView` の保存ボタン部分を次のようにする。

```ts
const extraActions = options.recipe?.id
  ? `<a class="button secondary" href="${escapeHtml(options.recipe.url ?? "")}" target="_blank" rel="noreferrer">元URLを開く</a>
     <button form="delete-form" type="submit">削除する</button>`
  : "";
```

フォームの直後に削除用フォームを追加する。

```ts
${options.recipe?.id ? `<form id="delete-form" method="post" action="/recipes/${escapeHtml(options.recipe.id)}/delete"></form>` : ""}
```

保存ボタンの行は次の形にする。

```ts
<div class="actions"><button type="submit">保存する</button>${extraActions}</div>
```

- [ ] **ステップ 4: テスト成功を確認する**

実行: `npm test -- test/app.test.ts`

期待結果: 追加した表示テストを含めて成功する。

- [ ] **ステップ 5: コミットする**

```bash
git add src/views/recipes.ts test/app.test.ts
git commit -m "feat: レシピ編集画面に削除操作を追加する"
```

## タスク 6: 全体検証とCloudflare用メモ

**対象ファイル:**

- 作成: `README.md`

- [ ] **ステップ 1: READMEを作成する**

````md
# レシピ保存

自分が作ったもの、作りたいもののレシピを保存する個人用Webアプリです。

## 構成

- Hono
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Access

## ローカル実行

```bash
npm install
npm run dev
```

## DB作成

```bash
npx wrangler d1 create recipe-vault
```

作成後、表示された `database_id` を `wrangler.jsonc` に設定します。

## マイグレーション

```bash
npx wrangler d1 migrations apply recipe-vault --local
npx wrangler d1 migrations apply recipe-vault --remote
```

## デプロイ

```bash
npm run deploy
```

## アクセス制限

Cloudflare Zero TrustのAccessで、このアプリのドメインをGoogleログイン必須にし、本人のGoogleメールアドレスだけを許可します。
````

- [ ] **ステップ 2: 全テストを実行する**

実行: `npm test`

期待結果: すべてのテストが成功する。

- [ ] **ステップ 3: 型チェックを実行する**

実行: `npm run typecheck`

期待結果: TypeScriptエラーなし。

- [ ] **ステップ 4: Wranglerのドライラン確認を実行する**

実行: `npx wrangler deploy --dry-run`

期待結果: Workerがビルドされ、デプロイ前検証が成功する。`database_id` が仮値のままなら、この時点で実IDへ差し替える。

- [ ] **ステップ 5: コミットする**

```bash
git add README.md
git commit -m "docs: レシピ保存アプリの運用手順を追加する"
```

## 自己レビュー

- 設計書の要件であるHono、Cloudflare Workers、D1、Cloudflare Access前提、URLタイトル取得、一覧、検索、絞り込み、作成、編集、削除、テスト、デプロイメモを各タスクに割り当てた。
- Cloudflare Accessはアプリ外設定なので、READMEに手順として明記した。
- アプリ内コメントや画面文言は日本語で統一する。コード識別子、パッケージ名、Cloudflare設定キーは英語のままにする。
- `wrangler.jsonc` の `database_id` は実際のD1作成後に差し替える必要がある。これはCloudflare側で発行される値のため、計画内に差し替え手順を明記した。
