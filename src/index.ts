import { Hono } from "hono";
import { handleGoogleCallback, requireAuth, startGoogleLogin } from "./lib/auth";
import { recipeRoutes } from "./routes/recipes";
import { styles } from "./styles";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requireAuth);

app.get("/styles.css", (c) => {
  return c.text(styles, 200, { "content-type": "text/css; charset=utf-8" });
});

app.get("/favicon.ico", (c) => {
  return c.body(null, 204);
});

app.get("/login", (c) => {
  return startGoogleLogin(c);
});

app.get("/auth/google/callback", async (c) => {
  return handleGoogleCallback(c);
});

app.route("/", recipeRoutes);

app.notFound((c) => c.text("見つかりませんでした。", 404));

export default app;
