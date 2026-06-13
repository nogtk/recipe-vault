# レシピ保存

自分が作ったもの、作りたいもののレシピを保存する個人用Webアプリです。

## 構成

- Hono
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Workers AI
- Googleログイン

## ローカル実行

`.dev.vars.example` を参考に `.dev.vars` を作ります。

```bash
GOOGLE_CLIENT_ID=Google OAuth クライアントID
GOOGLE_CLIENT_SECRET=Google OAuth クライアントシークレット
ALLOWED_EMAIL=naoga.taka@gmail.com
SESSION_SECRET=十分に長いランダム文字列
```

```bash
npm install
npm run dev
```

## DB作成

```bash
npx wrangler d1 create recipe-vault
```

作成後、表示された `database_id` を `wrangler.jsonc` に設定します。

## マイグレーション

```bash
npx wrangler d1 migrations apply recipe-vault --local
npx wrangler d1 migrations apply recipe-vault --remote
```

## デプロイ

初回デプロイ前に、Google OAuthとセッション用の値をWorker secretとして設定します。

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ALLOWED_EMAIL
npx wrangler secret put SESSION_SECRET
```

```bash
npm run deploy
```

## AIレシピ抽出

新規レシピ画面でURLを入力し、「AIで候補作成」を押すと、Webページ本文またはYouTubeの説明欄・字幕テキストから材料、手順、メモの候補を作ります。候補はそのまま保存せず、フォームで確認してから保存します。

Workers AIモデルは `wrangler.jsonc` の `AI_MODEL` で変えられます。初期値は次です。

```text
@cf/qwen/qwen3-30b-a3b-fp8
```

さらに安さを優先する場合は、次のような軽量モデルに差し替えて試せます。

```text
@cf/ibm-granite/granite-4.0-h-micro
```

## アクセス制限

アプリ内のGoogleログインで保護します。Google OAuthクライアントのリダイレクトURIには次を登録します。

```text
https://recipe-vault.nogtk.workers.dev/auth/google/callback
```

ログイン後のメールアドレスが `ALLOWED_EMAIL` と一致する場合だけ、アプリへ入れます。
