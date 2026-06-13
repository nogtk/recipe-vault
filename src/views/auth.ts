import { escapeHtml } from "../lib/html";
import { layout } from "./layout";

export function loginView(error?: string): string {
  return layout(
    "ログイン",
    `
    <div class="topbar"><h1>ログイン</h1></div>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <form class="form" method="post" action="/login">
      <label>パスワード<input required name="password" type="password" autocomplete="current-password"></label>
      <div class="actions"><button type="submit">入る</button></div>
    </form>
  `,
  );
}
