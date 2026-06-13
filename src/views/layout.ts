import { escapeHtml } from "../lib/html";

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | レシピ保存</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="shell">${body}</main>
</body>
</html>`;
}
