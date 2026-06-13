# レシピ保存

自分が作ったもの、作りたいもののレシピを保存する個人用Webアプリです。

## 構成

- Hono
- Cloudflare Workers
- Cloudflare D1
- 簡易パスワードログイン

## ローカル実行

`.dev.vars.example` を参考に `.dev.vars` を作ります。

```bash
APP_PASSWORD=ローカル用パスワード
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

初回デプロイ前に、ログイン用パスワードをWorker secretとして設定します。

```bash
npx wrangler secret put APP_PASSWORD
```

```bash
npm run deploy
```

## アクセス制限

最初の版では、アプリ内の簡易パスワードログインで保護します。Cloudflare Accessを使う場合は、後からCloudflare Zero Trust側でこのアプリのドメインをGoogleログイン必須にし、本人のGoogleメールアドレスだけを許可します。
