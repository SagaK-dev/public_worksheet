# まなびのノート｜GitHub Pages用サイト

PDFなどの教材を配布し、ブログを書くためのサイトです。サイトの名前や紹介文を変更でき、教材をフォルダに追加すると一覧が自動で更新されます。公開時にGitHub Actionsがサイトを生成します。

## 1. GitHub Pagesで公開する

1. このリポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。このリポジトリには公開用のワークフローが含まれているため、テンプレートを新規に作る必要はありません。
2. **Actions → Build and deploy GitHub Pages → Run workflow** を押します。`main` が選ばれていることを確認し、実行します。
3. 完了後、**Settings → Pages → Visit site** からサイトを開きます。反映まで数分かかることがあります。

これ以降は `main` ブランチに変更を保存すると、自動でテスト・再公開されます。`main` 以外を公開対象にしたい場合は `.github/workflows/pages.yml` の `branches: [main]` を変更してください。

> 公開したサイトと教材は、URLを知っている人に限らずインターネット上からアクセスできます。個人情報や公開できない資料は入れないでください。

## 2. サイト名・紹介文を変更する

1. GitHubのリポジトリで `site.json` を開き、鉛筆マークを押します。
2. `:` の右側の、ダブルクォーテーション `"` の内側を書き換えます。
3. **Commit changes** を押します。公開処理が完了すると反映されます。

| 項目 | サイト上の表示 |
| --- | --- |
| `name` | サイト名 |
| `tagline` | トップの大きな見出し |
| `description` | トップとフッターの短い説明 |
| `aboutTitle` | サイト紹介の見出し |
| `aboutText` | サイト紹介の本文 |

ダブルクォーテーションを本文に入れる場合は `\"` と書き、改行は `\n` と書いてください。JSONのかっこやカンマを消すと公開処理が失敗します。

## 3. PDFなどの教材を追加する

1. GitHubで `materials` を開き、教材に合うフォルダ（例：`数学`）を開きます。
2. **Add file → Upload files** を選び、PDFなどをドラッグして **Commit changes** を押します。
3. 公開処理が完了すると、教材の一覧・カテゴリ・検索に自動で反映されます。

- ファイル名がそのまま教材名になります。例：`中3_二次関数.pdf` → 「中3 二次関数」
- `materials/英語/` のような、`materials` の直下にあるフォルダ名がカテゴリになります。新しいカテゴリは新しいフォルダを追加すれば作れます。
- `materials` 直下に置いたファイルは「その他」に表示されます。フォルダをさらに深くしても、最初のフォルダ名がカテゴリになります。
- PDFは新しいタブで開き、その他のファイルはダウンロードできるようにします。
- 対応形式：PDF、Word（doc/docx）、PowerPoint（ppt/pptx）、Excel（xls/xlsx）、テキスト（txt）、ZIP、PNG、JPEG。拡張子の大文字・小文字は問いません。
- 教材の削除・差し替えもGitHub上で行います。差し替え後、公開処理が終わるとサイトに反映されます。
- GitHubのブラウザ画面から追加できるファイルは、1ファイル25 MiBまでです。Git LFSに置いたファイルはこのサイトでは使えません。大きな資料は分割するなどしてください。

## 4. ブログの記事を書く

1. リポジトリの `posts` を開き、**Add file → Create new file** を選びます。
2. ファイル名を `年-月-日-英数字の名前.md` とします。例：`2026-11-16-study-notes.md`
3. 1行目に `# 記事のタイトル` と書き、空行を空けて本文を書きます。
4. **Commit changes** を押します。公開処理が完了すると、トップとブログ一覧に記事が表示されます。

```md
# 二次関数を学んで気づいたこと

最初の段落は、記事一覧の紹介文にも表示されます。

## 見出し

ここに本文を書きます。

- ポイント1
- ポイント2
```

記事の日付はファイル名で決まり、新しい日付が上に並びます。日付は表示と並べ替えに使われ、未来の日付を指定しても予約投稿にはなりません。サンプル記事 `posts/2026-11-16-welcome.md` は書き換えたり、削除したりできます。

本文にはMarkdownの見出し・箇条書き・太字・リンクなどを使えます。ブログの画像や教材へのリンクを相対パスで書く場合は、公開先の記事が `blog/記事名/index.html` になることを基準にしてください。たとえば `[資料を見る](../../materials/数学/例.pdf)` です。HTMLを直接書いた場合は、文字として表示されます。

## フォルダとファイル

```text
site.json                  サイト名・紹介文
materials/                 PDFなどの教材
  数学/ 理科/ 英語/ 国語/  教科ごとの教材
posts/                     ブログ記事（Markdown）
assets/                    デザインと検索機能
scripts/build.mjs          サイト生成処理
tests/                     サイト生成の自動テスト
vendor/                    Markdown変換ライブラリ（MIT License）
.github/workflows/pages.yml GitHub Pagesの自動公開設定
```

## うまく表示されないとき

- **Actionsに赤い × がある**：その実行を開き、`Build site` などのエラーを確認します。`site.json` の記号や、記事のファイル名の日付を確認してください。
- **Actionsの一覧にワークフローがない**：`.github/workflows/pages.yml` がリポジトリの最上位から正しい場所にあるか、隠しフォルダも含めてアップロードしたかを確認してください。
- **Pagesの設定画面が表示できない**：リポジトリの管理者権限とプランを確認してください。
- **記事・教材が更新されない**：変更が `main` に保存されたか、Actionsの実行が成功したか、数分後にブラウザを更新して確認してください。保護されたブランチではプルリクエストのマージが必要な場合があります。
- **教材が表示されない**：`materials` 内に対応する拡張子で保存したか確認してください。

## 自分のパソコンで確認する場合

Node.js 22以降がある場合は、このフォルダで `node scripts/build.mjs` を実行し、生成された `dist/index.html` を開きます。サイトの公開に、自分のパソコンへのNode.jsのインストールは不要です。

教材やブログを更新したときは、もう一度コマンドを実行すると `dist` が再生成されます。`node --test tests/*.test.mjs` で生成処理のテストを実行できます。

## 参考

- [GitHub Pagesの公開方法](https://docs.github.com/ja/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHubへのファイル追加](https://docs.github.com/ja/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- Markdown変換には [marked](https://github.com/markedjs/marked) を使用しています。ライセンスは `vendor/MARKED-LICENSE.md` を参照してください。
