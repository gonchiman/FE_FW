# FE FW

『ファイアーエムブレム 万紫千紅』の攻略支援アプリ用リポジトリ。
`arknights_2` を参考にした React・TypeScript・Vite アプリです。
共通のサイドバー・ヘッダーと、個人成長率・キャラクター名対応の一覧、成長率の統計分析ページを用意しています。
成長率ページには Fortunes-Weave-Helper の公開JSONから取り込んだ62名分の英語名・個人成長率を収録しています。
Game8の攻略記事に由来する出典データで、ゲーム内の数値との照合は未実施です。兵種補正・育成予測は含みません。

## 開発

Node.js 24 と npm を使用します。

```sh
npm ci
npm run dev
```

開発サーバーの表示する URL の `/FE_FW/` を開きます。
標準ポートの場合は `http://localhost:5173/FE_FW/` です。

```sh
npm test
npm run data:check
npm run build
npm run preview
```

`test` は Node.js 標準のテストランナーで、データ検証・検索・並べ替え・ルート解決を確認します。
`data:check` は取得したスナップショットとアプリ用JSONの一致を確認します。
`build` は TypeScript の型チェックと本番用ビルドを実行します。
`preview` は生成した `dist/` をローカルで確認するためのコマンドです。

## 構成

| 場所 | 用途 |
| --- | --- |
| `src/App.tsx` | アプリの入口。共通レイアウトにページを配置する |
| `src/components/AppShell.tsx` | サイドバー・ヘッダー・本文領域。狭い画面ではメニューを開閉する |
| `src/pages/GrowthRatesPage.tsx` | 個人成長率の検索・一覧・出典表示 |
| `src/pages/GrowthAnalysisPage.tsx` | 成長率の統計サマリー、条件抽出、ヒストグラムと一覧の連動 |
| `src/components/GrowthHistogram.tsx` | 人数・割合のヒストグラム、平均・中央値の基準線 |
| `src/lib/growth-statistics.ts` | 記述統計、共通軸と階級の集計 |
| `src/components/GrowthRatesTable.tsx` | 列の並べ替えと名前列を固定した成長率表 |
| `src/pages/CharacterNamesPage.tsx` | 日本語・英語の名前の検索、確認状況の絞り込み |
| `src/components/CharacterNamesTable.tsx` | 名前対応表と行ごとの出典表示 |
| `src/data/character-names.json` | 日本語名の対応、出典、取得日・確認日 |
| `src/components/DataTable.css` | 外枠・縦横罫線・数値配置などの共通テーブルスタイル |
| `src/lib/navigation.ts` | サイドバーのナビゲーション定義 |
| `src/lib/useHashRoute.ts` | ハッシュに応じたページ切り替え |
| `src/components/` | 画面・共通UI部品 |
| `src/lib/` | 計算やデータ変換などのロジック |
| `src/types/` | 共有する型 |
| `src/data/` | アプリ用に整えたデータ |
| `data/sources/` | 取得元のキーと値を保存したスナップショット・取得情報 |
| `public/` | 加工せず配信する静的ファイル |
| `tests/` | 機能追加時のテスト |
| `scripts/` | 開発・データ整備用のスクリプト |
| `docs/` | 設計・仕様・見本 |
| `instructions/` | 作業別の開発ルール |

成長率ページは `/FE_FW/#/growth-rates` で開きます。
データ形式と取り込み時の注意点は [成長率ページの仕様](docs/growth-rates.md) を参照してください。
取得したデータから表示用JSONを再生成するには `npm run data:import` を実行します。再生成と画面表示に外部通信は不要です。

成長率分析は `/FE_FW/#/analysis/growth-rates` で開きます。集計規約と操作は [成長率分析の仕様](docs/growth-analysis.md) を参照してください。

名前対応ページは `/FE_FW/#/character-names` で開きます。成長率データの62名を基準に、日本語名と英語名の対応を表示します。
日本語名は62名分を収録しています。任天堂の人物紹介と開発者インタビューに加え、日英名を併記したファンサイトや人物紹介記事で対応を確認し、各行に出典と照合内容を記録しています。今後追加する対応未確認の名前は `null` として扱います。
名前の確認状況は成長率の確認状況とは別に管理します。出典と更新方法は [名前対応ページの仕様](docs/character-names.md) を参照してください。

ページを追加するときは、`AppShell` にページ名・現在のページID・本文の `children` を渡します。
ナビゲーション項目は `src/lib/navigation.ts` に追加し、リンク先とページ表示の切り替えを `src/App.tsx` 側で対応させます。

## 作業ルール

作業前に [AGENTS.md](AGENTS.md) の参照一覧を確認してください。
依存は取得可能な安定版を明示し、`package-lock.json` で固定します。

GitHub Actions は依存のインストール・ビルド・テストを確認します。
Vite の公開パスは `/FE_FW/` です。公開先の設定やデプロイは別途行います。
