# レシピ保存アプリ設計

## 目的

自分が作ったレシピ、またはこれから作りたいレシピを保存するための小さな個人用Webアプリを作る。最初の版はインターネット上に公開するが、Cloudflare Accessで本人だけがアクセスできる状態にする。

## 利用する基盤

- 実行環境: Cloudflare Workers
- Webフレームワーク: Hono + TypeScript
- データベース: Cloudflare D1
- デプロイ: Wrangler
- アクセス制限: Cloudflare Access + Googleログイン。許可するGoogleアカウントは本人のみ

最初の版では、アプリ本体にGoogle OAuthを実装しない。Cloudflare Accessでサイト全体を保護し、認証済みのリクエストだけがWorkerに届く構成にする。

## 体験

最初に表示する画面はレシピ一覧にする。一覧では検索、ステータス絞り込み、タグ絞り込みができる。既存レシピの表示、新規追加、編集、削除もここから行えるようにする。

レシピ作成はURL入力から始める。Worker側で対象ページを取得し、HTMLのタイトルを読みにいく。タイトル取得に失敗した場合は、URLを仮タイトルとして保存し、あとから編集できるようにする。

各レシピには次の情報を保存する。

- URL
- タイトル
- ステータス: `want_to_make` または `made`
- タグ
- 材料
- 手順
- メモ
- 作成日時と更新日時

## 画面

### レシピ一覧

保存済みレシピを更新日時の新しい順に表示する。各項目にはタイトル、ステータス、タグ、URLのホスト名、メモの短いプレビューを表示する。

操作:

- タイトル、URL、タグ、材料、手順、メモを対象にしたテキスト検索
- ステータス絞り込み
- タグ絞り込み
- 新規作成画面へのリンク

### 新規レシピ

URL入力欄と、任意入力のタイトル、ステータス、タグ、材料、手順、メモを表示する。タイトルが空の場合は、送信時にサーバー側でURL先のタイトル取得を試みる。

### レシピ詳細・編集

すべてのレシピ項目を編集できるフォームとして表示する。ユーザーは各項目の更新、元URLを開く操作、レシピ削除ができる。

## データモデル

テーブル: `recipes`

- `id` text primary key
- `url` text not null
- `title` text not null
- `status` text not null。値は `want_to_make` または `made` に制限する
- `tags` text not null。JSON配列として保存する
- `ingredients` text not null default empty string
- `steps` text not null default empty string
- `notes` text not null default empty string
- `created_at` text not null。ISO形式の日時
- `updated_at` text not null。ISO形式の日時

インデックス:

- `idx_recipes_updated_at` on `updated_at`
- `idx_recipes_status` on `status`

## ルート

- `GET /` レシピ一覧
- `GET /recipes/new` 新規レシピフォーム
- `POST /recipes` レシピ作成
- `GET /recipes/:id` レシピ詳細・編集フォーム
- `POST /recipes/:id` レシピ更新
- `POST /recipes/:id/delete` レシピ削除

## アーキテクチャ

Workerのエントリーポイントで、D1バインディング `DB` を持つ型付きHonoアプリを作る。

コードは小さなモジュールに分ける。

- `src/index.ts`: アプリ作成とルート登録
- `src/routes/recipes.ts`: レシピ用ルートとリクエスト処理
- `src/db/recipes.ts`: D1クエリと行データの変換
- `src/views/layout.ts`: 共通HTMLレイアウト
- `src/views/recipes.ts`: 一覧とフォームのHTML
- `src/lib/url-title.ts`: URLタイトル取得とHTML解析
- `src/lib/forms.ts`: フォーム解析とバリデーション補助

最初の版はサーバー生成HTMLで軽く作る。CSSは `src/styles.ts` に置き、ルートから配信するか、レイアウトに埋め込む。

## バリデーションとエラー

URLは必須で、`http:` または `https:` として解析できる必要がある。タイトルはフォールバック後に必須とする。ステータスは許可された値だけを受け付ける。タグはカンマ区切りの入力をトリムし、重複を除去してJSONとして保存する。

タイトル取得に失敗しても、作成処理はフォールバックタイトルで成功させる。ユーザー向けのエラーは、短いメッセージ付きでフォームを再表示する。想定外エラーは汎用エラー画面を返し、構造化ログに詳細を出す。

## テスト

単体テストで確認する内容:

- タグ解析
- URLバリデーション
- HTMLからのタイトル抽出
- フォーム入力の正規化

結合寄りのスモークチェックで確認する内容:

- TypeScriptでビルドできること
- D1マイグレーションSQLが有効であること
- 主要ルートが想定したHTMLを返すこと

## デプロイメモ

Wrangler設定にはWorker、compatibility date、`nodejs_compat`、observability、D1バインディングを定義する。Cloudflare Accessはアプリ外部のCloudflareダッシュボード、またはZero Trust設定で構成する。
