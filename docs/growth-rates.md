# 成長率ページ

## 範囲と画面

`/FE_FW/#/growth-rates` に個人成長率を表示する。ホームは従来どおり本文が空のページ。
兵種補正や育成予測は含まない。

- 既存の `AppShell` とナビゲーションを利用する。
- 名前で検索し、名前・各能力値の見出しで昇順／降順を切り替える。能力値は最初に降順、名前は最初に昇順。
- 検索は全半角・大小文字・ひらがな／カタカナを共通化する。
- 未確認値は `null` のまま保持して「—」と表示し、並べ替えでは常に末尾へ置く。`0` は数値として扱う。同値では名前・ID順で結果を安定させる。
- スマートフォンでは名前列を固定し、表の中だけ横スクロールする。表はキーボードでもフォーカスできる。
- 出典情報は初期状態で閉じた「データの出典」に表示する。

## データと表示の分離

型・能力キー・表示順の定義元は [growth.ts](../src/types/growth.ts)。
表示用JSONは [character-growths.json](../src/data/character-growths.json) で、Fortunes-Weave-Helper の公開JSONから取り込んだ62名・558値を収録する。キャラクター名は英語表記をそのまま使う。
ゲーム内の数値との照合は未実施のため、すべての行を `status: "unverified"` とする。全行が同じ状態の場合は表の上に「ゲーム内未照合」を表示する。

データには出典ID、URL、取得日、元データの版、ゲームの版、補足を保存する。
不明なメタデータは `null`。取得日はこのアプリがJSONを取得した日時で、元記事が調査・更新された日時ではない。
キャラクターは出典IDと確認状態（`sample` / `unverified` / `verified`）を持つ。
確認状態が混在する場合は未照合の行に「未照合」を表示する。仮データと他の状態が混在するときは、仮データの行にも状態を表示する。

取得元は [Rico0319/Fortunes-Weave-Helper の data/fwe.json](https://github.com/Rico0319/Fortunes-Weave-Helper/blob/29609cc76a0a79a86473ef1e0980771e94c97640/data/fwe.json)。元記事は [Game8 の成長率一覧](https://game8.co/games/Fire-Emblem-Fortunes-Weave/archives/618974)。リポジトリの更新に追従せず、このコミットの内容を固定して利用している。対象ゲームのバージョンは不明。

取得元から `units` のキー、`name`、`growths` だけを抽出し、[入力スナップショット](../data/sources/fortunes-weave-growths.json) に保存している。原文説明・評価・兵種・個人スキルなどは取り込まない。
このスナップショットは上流のファイル全体ではなく、必要項目を変更せず抜き出したものである。`fileBlobSha` は上流のJSONファイル全体のGit blob SHAであり、この抽出ファイルのハッシュではない。
取得情報に、リポジトリ・コミット・元ファイルパス・上流のGit blob SHA・取得日時・出典URLを保存する。
元リポジトリには取得時点で明示的なライセンスを確認できていない。出典の記録は転載許諾や数値の正確性の確認を意味しない。

## 再生成と更新

`npm run data:import` が [取り込みスクリプト](../scripts/import-growths.ts) を実行し、入力スナップショットから表示用JSONを生成する。`npm run data:check` は生成結果との一致だけを検証し、ファイルを書き換えない。
変換処理は [import-growths.ts](../scripts/lib/import-growths.ts)。キー名で能力値を対応付けるため、元JSONの `Spd` と `Dex` などの並び順が表示順と違っても取り違えない。数値の補正・推測・兵種加算は行わない。
元の成長率の明示的な `null` と `0` を区別し、欠落した項目・不正な値・衝突するIDはエラーにする。読み取り・変換が完了してから出力する。
上流を更新する際はコミットを選んでJSONを取得し、必要項目と取得情報をスナップショットへ更新してから再生成する。表示用JSONだけを手編集しない。
欠損は `null`、未照合の数値は `unverified` として扱い、確認済みに自動変更しない。

[growth-data.ts](../src/data/growth-data.ts) が入力を検証する。
形の不一致、ID重複、存在しない出典参照、不正な成長率などがあれば、表を表示せず読み込みエラーを出す。
表示用の検索・並べ替えは [lib/growth.ts](../src/lib/growth.ts) にあり、元データを変更しない。

## 共通テーブルの基準

[DataTable.css](../src/components/DataTable.css) を共通の定義元とし、外枠・縦横罫線には `--border` を使う。
ヘッダーは `--surface-hover`、数値は右揃え・等幅数字。並べ替えボタンには状態と次の操作を付ける。
名前列の幅・固定位置・未確認値の色は [GrowthRatesTable.css](../src/components/GrowthRatesTable.css) に分離している。
現在の適用先は [GrowthRatesTable.tsx](../src/components/GrowthRatesTable.tsx)、[CharacterNamesTable.tsx](../src/components/CharacterNamesTable.tsx)、[GrowthAnalysisPage.tsx](../src/pages/GrowthAnalysisPage.tsx) の表。
今後の表はこの共通スタイルを読み込み、可変のデータ・列・並べ替え状態を用途に応じて渡す。

## 確認と見本の更新

`npm test` でデータ検証・検索・欠損値を含む並べ替え・ルート解決を確認し、`npm run build` で型チェックと本番ビルドを確認する。
`npm run dev` の `/FE_FW/#/growth-rates` が実装から再生成する表示見本となる。
データを変更する場合は入力スナップショットと対応する検証を更新して再生成し、PC・390px・320px幅で表示を確認する。
表示件数、検索結果なし、列の昇降順、横スクロール、サイドバー遷移、戻る操作、本文スキップリンクを確認する。
