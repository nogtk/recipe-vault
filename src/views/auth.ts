import { layout } from "./layout";

export function loginView(): string {
  return layout(
    "ログイン",
    `
    <div class="topbar"><h1>ログイン</h1></div>
    <div class="form">
      <p>Googleアカウントでログインします。</p>
      <div class="actions"><a class="button" href="/login">Googleでログイン</a></div>
    </div>
  `,
  );
}
