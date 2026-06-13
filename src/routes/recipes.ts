import { Hono } from "hono";
import { createRecipe, deleteRecipe, getRecipe, listRecipes, updateRecipe } from "../db/recipes";
import { parseRecipeForm } from "../lib/forms";
import { extractRecipeCandidate } from "../lib/recipe-extraction";
import { fetchPageTitle, titleFromUrlFallback } from "../lib/url-title";
import type { Env, RecipeStatus } from "../types";
import { recipeFormView, recipeListView } from "../views/recipes";

export const recipeRoutes = new Hono<{ Bindings: Env }>();

recipeRoutes.get("/", async (c) => {
  const query = c.req.query("q")?.trim() || undefined;
  const tag = c.req.query("tag")?.trim() || undefined;
  const rawStatus = c.req.query("status");
  const status = rawStatus === "want_to_make" || rawStatus === "made" ? (rawStatus as RecipeStatus) : undefined;
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
  const title = result.value.title || (await fetchPageTitle(result.value.url)) || titleFromUrlFallback(result.value.url);
  const recipe = await createRecipe(c.env.DB, { ...result.value, title });
  return c.redirect(`/recipes/${recipe.id}`);
});

recipeRoutes.post("/recipes/extract", async (c) => {
  const form = await c.req.formData();
  const url = String(form.get("url") ?? "").trim();

  try {
    const candidate = await extractRecipeCandidate(c.env, url);
    return c.html(
      recipeFormView({
        title: "新規レシピ",
        action: "/recipes",
        recipe: {
          ...candidate,
          status: String(form.get("status") || "want_to_make") === "made" ? "made" : "want_to_make",
          tags: String(form.get("tags") ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
      }),
    );
  } catch (error) {
    return c.html(
      recipeFormView({
        title: "新規レシピ",
        action: "/recipes",
        recipe: { url },
        errors: [error instanceof Error ? error.message : "AIで候補を作れませんでした。"],
      }),
      400,
    );
  }
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
