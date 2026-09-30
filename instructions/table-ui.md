# テーブルの表示方針

このアプリのテーブルを新規作成・修正するときに適用する。

- 作り始める前に、既存ページの用途の近いテーブルを確認し、既存のコンポーネントやスタイルを優先して使う。
- ユーザーから別の指定がない限り、外枠と縦横の罫線があるテーブルを標準とする。枠や縦罫線を省略した表示を初期案にしない。
- 枠と罫線は薄いグレーの 1px 線を使う。色は共通の `--border` に定義して参照し、テーブルごとに値を複製しない。
- 見出しの背景、セルの余白、文字サイズ、文字・数値の配置は、同じ用途の既存テーブルに揃える。
- 共通スタイルは [DataTable.css](../src/components/DataTable.css)、基準となる実装は [GrowthRatesTable.tsx](../src/components/GrowthRatesTable.tsx)。名前列の固定などページ固有の指定は [GrowthRatesTable.css](../src/components/GrowthRatesTable.css) を参照する。
- 仕様・使用例・確認方法は [成長率ページの仕様](../docs/growth-rates.md) を参照する。
