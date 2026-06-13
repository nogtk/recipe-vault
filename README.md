# レシピ保存

自分が作ったもの、作りたいもののレシピを保存する個人用Webアプリです。

## 構成

- Hono
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Access

## ローカル実行

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

```bash
npm run deploy
```

## アクセス制限

Cloudflare Zero TrustのAccessで、このアプリのドメインをGoogleログイン必須にし、本人のGoogleメールアドレスだけを許可します。
