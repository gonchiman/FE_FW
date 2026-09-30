# FE FW

『ファイアーエムブレム 万紫千紅』の攻略支援アプリ用リポジトリ。
`arknights_2` を参考にした React・TypeScript・Vite の初期構成です。
共通のサイドバーとヘッダーを用意しています。本文は空で、ゲームデータや計算機能はまだありません。

## 開発

Node.js 24 と npm を使用します。

```sh
npm ci
npm run dev
```

開発サーバーの表示する URL の `/FE_FW/` を開きます。
標準ポートの場合は `http://localhost:5173/FE_FW/` です。

```sh
npm run build
npm run preview
```

`build` は TypeScript の型チェックと本番用ビルドを実行します。
`preview` は生成した `dist/` をローカルで確認するためのコマンドです。

## 構成

| 場所 | 用途 |
| --- | --- |
| `src/App.tsx` | アプリの入口。共通レイアウトにページを配置する |
| `src/components/AppShell.tsx` | サイドバー・ヘッダー・本文領域。狭い画面ではメニューを開閉する |
| `src/lib/navigation.ts` | サイドバーのナビゲーション定義 |
| `src/components/` | 画面・共通UI部品 |
| `src/lib/` | 計算やデータ変換などのロジック |
| `src/types/` | 共有する型 |
| `src/data/` | アプリ用に整えたデータ |
| `public/` | 加工せず配信する静的ファイル |
| `tests/` | 機能追加時のテスト |
| `scripts/` | 開発・データ整備用のスクリプト |
| `docs/` | 設計・仕様・見本 |
| `instructions/` | 作業別の開発ルール |

ゲーム用のディレクトリには空の配置先だけを用意しています。
テスト対象のロジックができた段階で、テスト実行コマンドを追加します。

ページを追加するときは、`AppShell` にページ名・現在のページID・本文の `children` を渡します。
ナビゲーション項目は `src/lib/navigation.ts` に追加し、リンク先とページ表示の切り替えを `src/App.tsx` 側で対応させます。

## 作業ルール

作業前に [AGENTS.md](AGENTS.md) の参照一覧を確認してください。
依存は取得可能な安定版を明示し、`package-lock.json` で固定します。

GitHub Actions は依存のインストールとビルドを確認します。
Vite の公開パスは `/FE_FW/` です。公開先の設定やデプロイは別途行います。
