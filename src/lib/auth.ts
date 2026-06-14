import type { Context, Next } from "hono";
import type { Env } from "../types";

const sessionCookieName = "recipe_session";
const stateCookieName = "oauth_state";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type SessionPayload = {
  email: string;
  exp: number;
};

type GoogleUser = {
  email: string;
  email_verified: boolean;
};

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

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlEncodeText(value: string): string {
  return base64Url(new TextEncoder().encode(value));
}

function base64UrlDecodeText(value: string): string {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export function requiredAuthEnv(env: Env): string | null {
  if (!env.GOOGLE_CLIENT_ID) return "GOOGLE_CLIENT_IDが未設定です。";
  if (!env.GOOGLE_CLIENT_SECRET) return "GOOGLE_CLIENT_SECRETが未設定です。";
  if (!env.ALLOWED_EMAIL) return "ALLOWED_EMAILが未設定です。";
  if (!env.SESSION_SECRET) return "SESSION_SECRETが未設定です。";
  return null;
}

export async function createSessionCookie(email: string, secret: string): Promise<string> {
  const payload = base64UrlEncodeText(
    JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds }),
  );
  const signature = await hmacSha256(payload, secret);
  return `${sessionCookieName}=${payload}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${sessionMaxAgeSeconds}`;
}

async function readSession(cookie: string | undefined, secret: string): Promise<SessionPayload | null> {
  const token = parseCookie(cookie)[sessionCookieName];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if ((await hmacSha256(payload, secret)) !== signature) return null;

  try {
    const session = JSON.parse(base64UrlDecodeText(payload)) as SessionPayload;
    return session.exp >= Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

export async function hasValidSession(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const session = await readSession(c.req.header("cookie"), c.env.SESSION_SECRET);
  return session?.email === c.env.ALLOWED_EMAIL;
}

export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  if (
    c.req.path === "/login" ||
    c.req.path === "/auth/google/callback" ||
    c.req.path === "/styles.css" ||
    c.req.path === "/favicon.ico"
  ) {
    await next();
    return;
  }

  const envError = requiredAuthEnv(c.env);
  if (envError) return c.text(envError, 500);

  if (await hasValidSession(c)) {
    await next();
    return;
  }

  return c.redirect("/login");
}

export function startGoogleLogin(c: Context<{ Bindings: Env }>): Response {
  const envError = requiredAuthEnv(c.env);
  if (envError) return c.text(envError, 500);

  const state = randomToken();
  const redirectUri = new URL("/auth/google/callback", c.req.url).toString();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("login_hint", c.env.ALLOWED_EMAIL);
  url.searchParams.set("prompt", "select_account");

  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      "set-cookie": `${stateCookieName}=${encodeURIComponent(state)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}

async function exchangeCodeForUser(c: Context<{ Bindings: Env }>, code: string): Promise<GoogleUser | null> {
  const redirectUri = new URL("/auth/google/callback", c.req.url).toString();
  const body = new URLSearchParams({
    code,
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResponse.ok) return null;

  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return null;

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!userResponse.ok) return null;

  return (await userResponse.json()) as GoogleUser;
}

export async function handleGoogleCallback(c: Context<{ Bindings: Env }>): Promise<Response> {
  const envError = requiredAuthEnv(c.env);
  if (envError) return c.text(envError, 500);

  const state = c.req.query("state");
  const code = c.req.query("code");
  const storedState = parseCookie(c.req.header("cookie"))[stateCookieName];

  if (!state || !code || state !== storedState) {
    return c.text("Googleログインのstate検証に失敗しました。", 401);
  }

  const user = await exchangeCodeForUser(c, code);
  if (!user?.email_verified) {
    return c.text("Googleアカウントのメール確認に失敗しました。", 401);
  }
  if (user.email !== c.env.ALLOWED_EMAIL) {
    return c.text("許可されていないGoogleアカウントです。", 403);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: "/",
      "set-cookie": await createSessionCookie(user.email, c.env.SESSION_SECRET),
    },
  });
}
