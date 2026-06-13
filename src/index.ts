import { Hono } from "hono";
import { recipeRoutes } from "./routes/recipes";
import { styles } from "./styles";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/styles.css", (c) => {
  return c.text(styles, 200, { "content-type": "text/css; charset=utf-8" });
});

app.get("/favicon.ico", (c) => {
  return c.body(null, 204);
});

app.route("/", recipeRoutes);

app.notFound((c) => c.text("見つかりませんでした。", 404));

export default app;
