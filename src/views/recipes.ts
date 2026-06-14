import { escapeHtml, hostFromUrl } from "../lib/html";
import type { Recipe, RecipeInput, RecipeStatus } from "../types";
import { layout } from "./layout";

const statusLabels: Record<RecipeStatus, string> = {
  want_to_make: "作りたい",
  made: "作った",
};

function ingredientItemsFromText(text: string): string[] {
  return text
    .split(/\r?\n|[、，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ingredientsPreview(text: string): string {
  const items = ingredientItemsFromText(text);
  if (!items.length) return "";

  const visibleItems = items.slice(0, 12);
  const remainingCount = items.length - visibleItems.length;
  return `
      <div class="ingredient-preview">
        <strong>材料</strong>
        <div class="ingredient-list">
          ${visibleItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          ${remainingCount > 0 ? `<span class="ingredient-more">ほか${remainingCount}件</span>` : ""}
        </div>
      </div>`;
}

export function recipeListView(recipes: Recipe[], filters: { query?: string; status?: string; tag?: string }): string {
  const cards = recipes
    .map(
      (recipe) => `
    <article class="recipe-card">
      <header class="recipe-card-header">
        <div>
          <h2><a href="/recipes/${escapeHtml(recipe.id)}">${escapeHtml(recipe.title)}</a></h2>
          <div class="meta"><span>${statusLabels[recipe.status]}</span><span>${escapeHtml(hostFromUrl(recipe.url))}</span></div>
        </div>
        <a class="source-link" href="${escapeHtml(recipe.url)}" target="_blank" rel="noreferrer">元サイト</a>
      </header>
      ${recipe.ingredients ? ingredientsPreview(recipe.ingredients) : ""}
      ${recipe.notes ? `<p class="notes">${escapeHtml(recipe.notes.slice(0, 120))}</p>` : ""}
      <div class="tags">${recipe.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `,
    )
    .join("");

  return layout(
    "レシピ一覧",
    `
    <div class="topbar"><div><p class="eyebrow">Recipe Vault</p><h1>レシピ保存</h1></div><a class="button" href="/recipes/new">新規レシピ</a></div>
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
  const extraActions = options.recipe?.id
    ? `<a class="button secondary" href="${escapeHtml(options.recipe.url ?? "")}" target="_blank" rel="noreferrer">元URLを開く</a>
       <button form="delete-form" type="submit">削除する</button>`
    : "";
  return layout(
    options.title,
    `
    <div class="topbar"><div><p class="eyebrow">Recipe Vault</p><h1>${escapeHtml(options.title)}</h1></div><a class="button secondary" href="/">一覧へ</a></div>
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
      <div class="actions">
        <button type="submit">保存する</button>
        ${options.recipe?.id ? "" : `<button type="submit" formaction="/recipes/extract" formmethod="post">AIで候補作成</button>`}
        ${extraActions}
      </div>
    </form>
    ${options.recipe?.id ? `<form id="delete-form" method="post" action="/recipes/${escapeHtml(options.recipe.id)}/delete"></form>` : ""}
  `,
  );
}
