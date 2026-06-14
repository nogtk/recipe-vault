日本語で簡潔かつ丁寧に回答してください。

## Git / Worktree 運用

このリポジトリでは、通常の作業はすべて `git wt` ベースの worktree で行います。
メイン checkout `/Users/takanaoga/Documents/receipt` は、状況確認とユーザーの未コミット変更の退避場所として扱い、直接編集しないでください。

基本フロー:

```bash
git fetch origin
git wt codex/<task-slug> origin/main --nocd
cd ../receipt-wt/codex/<task-slug>
npm ci
npm run check
```

作業後:

```bash
git push -u origin codex/<task-slug>
gh pr create --base main --head codex/<task-slug>
```

PR マージ後:

```bash
git wt -d codex/<task-slug>
```

運用ルール:

- ブランチ名は原則 `codex/<task-slug>` にします。
- worktree の置き場は repo ローカル設定 `wt.basedir=../{gitroot}-wt` を使います。
- `git wt` は `wt.nocd=true` にして、出力された path に明示的に `cd` します。
- ユーザーの未コミット変更がある checkout では、勝手に stash、restore、merge、rebase しません。
- ユーザーの未コミット変更を使う必要がある場合は、先に方針を説明してから扱います。
- PR 作成前に `npm run check` を実行します。
- main への反映は PR 経由にします。
