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
    params.push(`%"${filters.tag}"%`);
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
