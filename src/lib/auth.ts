import type { Context, Next } from "hono";
import type { Env } from "../types";

const sessionCookieName = "recipe_session";

function parseCookie(header: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (header ?? "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index === -1 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken(password: string): Promise<string> {
  return sha256Hex(`recipe-vault:${password}`);
}

export async function hasValidSession(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const expected = await sessionToken(c.env.APP_PASSWORD);
  const cookies = parseCookie(c.req.header("cookie"));
  return cookies[sessionCookieName] === expected;
}

export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  if (c.req.path === "/login" || c.req.path === "/styles.css" || c.req.path === "/favicon.ico") {
    await next();
    return;
  }

  if (!c.env.APP_PASSWORD) {
    return c.text("APP_PASSWORDが未設定です。", 500);
  }

  if (await hasValidSession(c)) {
    await next();
    return;
  }

  return c.redirect("/login");
}

export async function sessionCookie(password: string): Promise<string> {
  const token = await sessionToken(password);
  return `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;
}
