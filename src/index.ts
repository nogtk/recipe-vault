import { Hono } from "hono";
import { requireAuth, sessionCookie } from "./lib/auth";
import { recipeRoutes } from "./routes/recipes";
import { styles } from "./styles";
import type { Env } from "./types";
import { loginView } from "./views/auth";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requireAuth);

app.get("/styles.css", (c) => {
  return c.text(styles, 200, { "content-type": "text/css; charset=utf-8" });
});

app.get("/favicon.ico", (c) => {
  return c.body(null, 204);
});

app.get("/login", (c) => {
  return c.html(loginView());
});

app.post("/login", async (c) => {
  const form = await c.req.formData();
  const password = String(form.get("password") ?? "");

  if (password !== c.env.APP_PASSWORD) {
    return c.html(loginView("パスワードが違います。"), 401);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: "/",
      "set-cookie": await sessionCookie(password),
    },
  });
});

app.route("/", recipeRoutes);

app.notFound((c) => c.text("見つかりませんでした。", 404));

export default app;
