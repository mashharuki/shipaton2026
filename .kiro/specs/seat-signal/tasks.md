# Implementation Plan — seat-signal

> 18.4（ストア説明文・スクリーンショットの準備）はコード外成果物のため本プランの対象外（意図的除外。運用チェックリストで管理）。

- [x] 1. 共有基盤: frontend / backend 共通コードの確立
- [x] 1.1 共通エラー処理・Result・ユーティリティの共有パッケージを作成する
  - 純粋 TypeScript 制約（依存は zod のみ、プラットフォーム API の型を持たない tsconfig）を持つ新規ワークスペースパッケージを作る
  - Result 型、AppError 型・ファクトリ・型ガード、エラーコード定数、エラーコード→文言キーのマップを提供する
  - 15 分粒度の時間帯バケット変換・曜日種別判定、zod パース結果を Result へ変換するヘルパを提供する
  - このパッケージで Vitest が実行できるようにする
  - 完了条件: frontend / backend 双方から import 可能で、ユーティリティのユニットテストと `pnpm check` が通る
  - _Requirements: 15.5, 14.3, 16.2_

- [x] 1.2 API・データセット・分析イベントの契約スキーマを定義する
  - 全 API エンドポイントの入出力スキーマ（未知フィールドは拒否。位置情報・ユーザー識別子に相当するフィールドを持たない）
  - データセット 3 種（時刻表・混雑プロファイル・補正統計）の schemaVersion 付きスキーマ
  - ファネル計測イベント名と付与プロパティの単一定義
  - 全スキーマに example / description メタデータを付与する（OpenAPI 生成の素材）
  - 完了条件: 代表ペイロードのパース成功と、スキーマ外フィールド・不正値の拒否を検証するテストが通る
  - _Requirements: 5.8, 8.6, 16.2, 16.3, 17.1, 17.2, 17.5_

- [x] 1.3 予測ドメイン定数とスコアリング純粋関数を実装する
  - 加算型スコアリング（基礎プロファイル＋曜日種別＋天候/イベント係数＋フィードバック補正＋遅延）を、データを引数で受け取る純粋関数として実装する
  - 係数・信頼度閾値・レンジ切替閾値・プラン制限値（検索 3 回/日・保存 1 件）・保持期間を定数として単一定義する
  - 予測結果に、実際に加算した項のみからなる寄与要素リストと信頼度・データ件数目安を含める
  - 信頼度が閾値を下回る場合は点推定ではなくレンジ表現へ切り替える
  - 完了条件: golden テストで「同一入力→同一出力」の決定性と、閾値をまたいだ際のレンジ切替・寄与要素の内容が検証される
  - _Requirements: 4.2, 5.2, 5.3, 5.4, 5.5, 5.6, 12.1_

- [x] 1.4 GitHub Actions の CI パイプラインを構築する
  - main への push / Pull Request をトリガーに、pnpm セットアップ（リポジトリの packageManager 指定に準拠）と依存インストールを行うワークフローを作成する
  - Biome チェック（`pnpm check`）、各ワークスペースの TypeScript 型チェック、Vitest（shared / backend / frontend）を並列ジョブで実行する
  - 後続タスクで追加されるテスト（Workers 統合テスト・OpenAPI ドリフト検証）が同一パイプラインで自動実行される構成にする
  - 完了条件: PR 作成時にワークフローが起動し、lint・型チェック・テストの全ジョブがグリーンで完了する
  - _Requirements: 18.6_

- [x] 2.1 Workers の実行バインディングと D1 データ基盤を構築する
  - D1・KV バインディング、Cron Trigger（日次・5 分毎）、シークレット（ODPT トークン・API 共有キー）を構成し、バインディング型を再生成する
  - D1 スキーマ（フィードバック・補正統計・誤差指標・分析イベント・通知登録）と、パラメタライズドクエリのみの型付きクエリ関数を実装する
  - Workers 統合テスト基盤（vitest-pool-workers）を導入する
  - 完了条件: マイグレーション適用済みのローカル D1 に対して型付きクエリの読み書きテストが通る
  - _Requirements: 5.9, 8.6, 10.1, 17.1_

- [x] 2.2 API 骨格と全ルートスタブを確立する
  - OpenAPIHono ベースのアプリ骨格、x-api-key 認証ミドルウェア、IP レート制限を実装する
  - 全 5 ルート（データセット・運行情報・フィードバック・イベント・通知登録）のモジュールスタブを作成しルート登録まで先行して行う — 以後の API タスクは自分のルートモジュールのみを変更し、アプリ組立てファイルには触れない
  - dev 環境で OpenAPI ドキュメント配信エンドポイントを公開する
  - 完了条件: ローカル dev サーバが起動し、ドキュメントエンドポイントが応答し、各スタブが 501 を返す
  - _Requirements: 5.8, 8.6, 10.1, 17.1_

- [x] 2.3 最小データセットの生成と KV 投入を整備する
  - 対象 1 路線分のスキーマ適合データセット 3 種を生成するスクリプトを実装する
  - 生成物を KV へ投入するスクリプトを実装する（Datasets API と通知 Cron が同一 payload を読む）
  - 生成物を開発・テスト・E2E 共用のフィクスチャとして配置する
  - 完了条件: スクリプト実行で生成・投入された payload が契約スキーマの検証に合格する
  - _Depends: 1.2, 2.1_
  - _Requirements: 3.1, 5.8, 15.3_

- [ ] 3. バックエンド API・集約・通知
- [x] 3.1 (P) データセット配信 API を実装する
  - 版指定付きの取得と、最新版と一致する場合の notModified 応答を実装する
  - KV に投入済みの payload を配信する
  - 完了条件: 統合テストで「版更新時に payload が返り、一致時に notModified となる」ことが検証される
  - _Depends: 2.3_
  - _Boundary: Datasets API_
  - _Requirements: 5.8, 15.2_

- [x] 3.2 (P) 運行情報プロキシ API を実装する
  - ODPT からの運行情報取得（トークンはサーバ側のみ）と 60 秒 KV キャッシュを実装する
  - ODPT 障害時はキャッシュ済みの値を stale フラグ付きで返す
  - 完了条件: 統合テストでキャッシュヒット・stale フォールバックの両分岐が検証される
  - _Boundary: TrainStatus API_
  - _Requirements: 7.3, 7.4_

- [x] 3.3 (P) フィードバック受付 API を実装する
  - 匿名 Trip ID・時間帯バケットのみのペイロードを受け付けて保存する
  - 個人単位でフィードバックを参照できる読み出し手段を提供しない
  - 完了条件: 統合テストで正常保存と、識別子・位置情報を含むペイロードの拒否が検証される
  - _Boundary: Feedback API_
  - _Requirements: 8.6, 8.7, 16.2, 16.4_

- [x] 3.4 フィードバック集約と誤差測定の日次バッチを実装する
  - サンプル数 5 未満のセルを出力しない補正統計の全量再計算（冪等）を実装する
  - 予測値と実測フィードバックの誤差指標（MAE）を日次記録する
  - 保持期間（90 日）を超えたフィードバックを削除する
  - 完了条件: 統合テストで「受付→集約→補正統計と誤差指標の生成・少数セル除外・期限切れ削除」の一連が検証される
  - _Depends: 3.3_
  - _Requirements: 5.9, 8.8, 16.2, 16.3_

- [x] 3.5 (P) 分析イベント収集 API を実装する
  - 最大 20 件のバッチ受付・超過時の 413 応答を実装する
  - スキーマ外フィールドを含むイベントを拒否し、Paywall トリガー種別などの定義済みプロパティを保存する
  - 完了条件: 統合テストで受理数の応答・スキーマ外拒否・上限超過の各分岐が検証される
  - _Boundary: Events API_
  - _Requirements: 17.1, 17.3, 17.5_

- [x] 3.6 (P) 通知登録 API を実装する
  - 通知登録の作成/更新と削除を実装する（保存項目はトークン・駅ペア・曜日・時刻・リード時間・ロケールのみ）
  - 完了条件: 統合テストで登録・更新・削除と最小項目制約が検証される
  - _Boundary: PushRegistrations API_
  - _Requirements: 10.1, 10.5_

- [ ] 3.7 通知配信バッチを実装する
  - 通知時刻の 15〜30 分前ウィンドウに該当する登録を抽出する
  - KV のデータセット payload（時刻表・混雑プロファイル）と D1 の補正統計を入力に、共有スコアリング関数で配信時点の予測を計算する
  - 通常より混雑が予測される場合は代替候補と削減できる予想立ち時間、変化理由（雨・イベント等）を含む通知を生成し、Expo Push で送信する
  - 日付付き送信済みフラグで重複送信を防止する（冪等）
  - 完了条件: 統合テストでウィンドウ抽出・通知 payload 内容・重複防止が検証される
  - _Depends: 2.3, 3.6_
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 3.8 OpenAPI 仕様書の生成とドリフト検証を実装する
  - ルート定義から OpenAPI 3.0 の yaml を生成するスクリプトを実装し、生成物をコミットする
  - 全ルートの operationId・summary・tags、全スキーマの example、共有 ErrorResponse、securityScheme、servers 2 件（ローカル・本番）を含める
  - ルート定義から再生成したドキュメントとコミット済み yaml の一致を検証するテストを追加する
  - 完了条件: 生成した yaml を Postman にインポートし、全エンドポイントがサンプルペイロード付きで実行可能であることを確認する
  - _Depends: 3.1, 3.2, 3.3, 3.5, 3.6_
  - _Requirements: 5.8, 8.6, 10.1, 17.1_

- [ ] 4. フロントエンド基盤
- [ ] 4.1 依存導入とアプリ骨格を構築する
  - 追加依存（状態管理・データフェッチ・SQLite・通知・i18n・クラッシュ計測ほか）を Expo 推奨の解決で導入する
  - ルートレイアウトに Provider 群を組み込み、ホーム/レポート/設定のタブ骨格とダーク/ライト外観切替を実装する
  - クラッシュ計測を初期化し、テンプレート由来の不要画面・コンポーネントを削除する
  - 完了条件: シミュレータでタブ 3 画面が表示され、外観切替が機能し、クラッシュがダッシュボードに記録される
  - _Requirements: 14.2, 15.4_

- [ ] 4.2 API クライアントとエラー表示基盤を実装する
  - オフライン検出・タイムアウト・HTTP エラーを共有エラーコードへ正規化する API クライアントを実装する
  - エラー種別に応じた文言と再試行手段を提示する共通エラー表示コンポーネントを実装する
  - 完了条件: オフライン時にオフライン表示と再試行、サーバエラー時に理解可能なメッセージが表示されるユニットテストが通る
  - _Requirements: 3.3, 13.7, 15.1, 15.5_

- [ ] 4.3 (P) ローカル DB とデータセット同期を実装する
  - SQLite のマイグレーション管理と、データセット 3 種の格納・版管理を実装する
  - 起動時と 24 時間間隔の同期、同期失敗時の既存データでの継続動作を実装する
  - 未同期路線の要求に対してはデータ欠如を示すエラーを返し、時刻表のみ表示への切替を促せるようにする
  - 完了条件: 機内モード相当でも保存済み時刻表データが読め、版更新時に置換されることがテストで検証される
  - _Depends: 2.3, 3.1_
  - _Boundary: DatasetRepository_
  - _Requirements: 5.8, 15.2, 15.3_

- [ ] 4.4 (P) 多言語基盤と言語切替を実装する
  - 日本語・英語の文言リソースと i18n 初期化を実装する
  - 設定からの言語切替を全画面へ即時反映する
  - 共有エラーコード→文言キー→表示文言の解決を接続する
  - 完了条件: 言語切替操作で表示中の画面の文言が再起動なしに切り替わる
  - _Boundary: i18n_
  - _Requirements: 14.1, 14.3_

- [ ] 4.5 (P) 分析イベントクライアントを実装する
  - イベントのバッファリングと最大 20 件のバッチ送信・失敗時再送を実装する
  - 対象路線・時間帯・ルート種別・差分時間・プラン種別・予測信頼度などの共通プロパティ付与を実装する
  - 完了条件: 発火したイベントがバッチ送信され、収集 API 経由で D1 に記録されることが確認できる
  - _Depends: 3.5_
  - _Boundary: AnalyticsClient_
  - _Requirements: 17.1, 17.2, 17.4_

- [ ] 4.6 (P) Playwright E2E 基盤を導入する
  - Playwright を導入し、Expo の web ターゲット起動とローカル Workers（またはモック API）を束ねる E2E 実行設定を作成する
  - 主要画面の共通セレクタ方針（testID ベース）を定め、タブ表示までのスモークテストを作成する
  - CI パイプラインに Playwright ジョブを追加する（1.4 のワークフローを拡張）
  - 完了条件: ローカルと CI の双方でスモークテストがグリーンになる
  - _Depends: 1.4, 4.1_
  - _Boundary: E2E Infrastructure_
  - _Requirements: 18.6_

- [ ] 5. 中核ループ: 検索・予測・比較・詳細
- [ ] 5.1 (P) 快適性プリファレンス設定を実装する
  - 速さ重視/バランス重視/快適さ重視の優先度と許容追加移動時間の設定を実装する
  - 立ち時間・乗換・歩行の許容度として設定を受け付け、身体的事情の直接入力を求めない
  - 設定を永続化し、次回以降の検索結果の順位付けに反映されるよう公開する
  - 完了条件: 設定変更後の検索で 3 案の選定・順位が変わることがテストで検証される
  - _Boundary: PreferenceStore_
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5.2 (P) ルート検索エンジンを実装する
  - 保存済み時刻表からの経路候補列挙（対象区間内・乗換含む）を端末内で実装する
  - 対象区間外の指定には区間外であることを示すエラーを返す
  - 最近使った検索条件の保存と再利用を実装する
  - 完了条件: フィクスチャ時刻表に対する既知区間の検索で期待候補が返り、区間外判定が機能するユニットテストが通る
  - _Depends: 4.3_
  - _Boundary: RouteSearchEngine_
  - _Requirements: 3.1, 3.2, 3.4, 16.1_

- [ ] 5.3 予測エンジンの統合と理由説明を実装する
  - ローカル DB のプロファイル・補正統計を共有スコアリング関数へ接続し、ルート区間ごとの予測を端末内で算出する
  - 途中駅ごとの着座確率と、使用した要素のみに基づく理由説明文の生成を実装する
  - 説明可能なデータがない場合の「データ不足」表示と、予測データ不足時の時刻表のみ表示への切替を実装する
  - 完了条件: 同一条件の再検索で同一予測が返り、理由説明が寄与要素と一致することがテストで検証される
  - _Depends: 1.3, 4.3_
  - _Requirements: 5.1, 5.6, 5.7, 6.2, 15.3, 16.1_

- [ ] 5.4 3 ルート選定と比較画面を実装する
  - プリファレンスを反映した「最速」「バランス」「最も快適」の 3 案選定を実装する
  - 各案に到着時刻・所要時間・最速との差分・予想立ち時間・予想着座時間・着座確率・乗換回数・快適性スコア・信頼度を表示する
  - 快適ルート選択時に「追加 N 分で予想立ち時間を M 分削減」の差分表示を行う
  - 3 案比較を 1 画面内で完結させ、計算中はローディングを表示する
  - 完了条件: 検索実行から 3 案が全指標付きで 1 画面に表示され、差分表示が確認できる
  - _Depends: 5.1, 5.2, 5.3_
  - _Requirements: 2.3, 3.5, 4.1, 4.2, 4.3, 4.4_

- [ ] 5.5 ルート詳細・乗車位置案内画面を実装する
  - 利用列車・発車時刻・推奨号車・推奨乗車位置・推奨理由・信頼度の表示を実装する
  - 途中駅ごとの着座確率の変化を表示する
  - 案内粒度は号車または車両エリア単位に限定する（ドア単位の精度を提示しない）
  - ホーム上の待機位置と進行方向を視覚的に表示する
  - 完了条件: 選択ルートの詳細画面で号車案内・駅ごと確率・待機位置の視覚表示が確認できる
  - _Depends: 5.3_
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. サブスクリプション（課金検証レーンを早期確立）
- [ ] 6.1 (P) RevenueCat SDK 導入と開発ビルドを確立する
  - 課金 SDK と Paywall UI SDK を導入し、EAS development build を作成して実機起動する
  - sandbox 環境で商品情報（月額・年額）が取得できることを確認する
  - Expo Go では Preview API Mode で動作し、課金以外の機能開発を阻害しないことを確認する
  - 完了条件: dev build 実機で Offering の商品 2 種が取得でき、Expo Go でもアプリがクラッシュしない
  - _Boundary: Subscription_
  - _Requirements: 13.1, 13.7_

- [ ] 6.2 エンタイトルメント判定と無料枠制御を実装する
  - Pro 判定の一元化と CustomerInfo 変化の監視（購入・解約・期限切れの反映）を実装する
  - 日次検索カウンタ（日付切替でリセット）と 3 種の Paywall トリガー（検索上限・Pro 機能・保存上限）を実装する
  - 初回起動直後に Paywall を表示するトリガーが存在しないことを保証する
  - 完了条件: Free で 3 回まで許可・4 回目でトリガー発火・翌日リセット・Pro で無制限がユニットテストで検証される
  - _Depends: 1.3, 6.1_
  - _Requirements: 12.1, 12.2, 12.5, 13.3, 13.8_

- [ ] 6.3 Paywall と購入・復元フローを実装する
  - 月額 ¥680 / 年額 ¥5,400（月あたり換算表示付き）と 7 日間無料トライアルを提示する
  - Free/Pro の機能比較と削減できた予想立ち時間などの価値提示を行う
  - 購入完了で Pro を即時解放、「購入を復元」、キャンセル時は非エラーで購入前状態へ復帰、商品取得失敗時は再試行手段を提示する
  - プライバシーポリシー・利用規約への遷移と、自動更新条件・解約方法の明示を行う
  - 完了条件: dev build 実機で sandbox 購入が完走し Pro 機能が解放される
  - _Depends: 6.1, 6.2_
  - _Requirements: 12.6, 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 13.9, 13.10_

- [ ] 6.4 無料プラン制限を検索・比較・詳細画面へ統合する
  - 無料プランの 4 回目検索で Paywall を表示する
  - 比較・詳細画面の Pro 専用要素（詳細な号車・乗車位置案内、駅ごと着座予測の全区間表示）をゲートする — コーチのゲートは 7.1 が、詳細レポートのゲートは 8.3 が同じ判定機構を用いて各自所有する
  - Free で利用可能な範囲（3 ルート比較・基本予測・基本着座確率・フィードバック送信）を維持する
  - Paywall 表示をトリガー種別付きで計測イベントに記録する
  - 完了条件: Free アカウントで 4 回目検索と Pro 要素タップの双方から Paywall へ遷移し、トリガー種別が計測に記録される
  - _Depends: 5.4, 6.2, 6.3_
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 17.3_

- [ ] 7. 乗車体験: Live Comfort Coach・フィードバック
- [ ] 7.1 乗車セッションと Live Comfort Coach を実装する
  - 乗車開始で現在駅・次の駅・残り駅数・現在の予想立ち時間を表示するセッションを実装する
  - 駅ごとの着座確率と次の着座チャンスの自動更新を実装する
  - 位置情報が取得できない場合は時刻表と経過時間による駅進行推定で案内を継続する
  - 目的地接近時の降車案内と、号車・エリア単位の集団統計表現のみを用いる文言制約を実装する
  - コーチ入口に Pro ゲートを適用する
  - 完了条件: 位置情報オフでもセッションが駅進行を推定して更新され、降車案内が発火することがテストで検証される
  - _Depends: 5.3, 6.2_
  - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6, 12.4_

- [ ] 7.2 遅延・運行情報のコーチへの反映を実装する
  - 運行情報のポーリングと、遅延・運行変化検知時の予測再計算・表示反映を実装する
  - 運行情報が stale の場合も案内を継続する
  - 完了条件: 運行情報の変化をモックした際に表示中の予測が再計算・更新される
  - _Depends: 3.2, 7.1_
  - _Requirements: 7.3, 7.4_

- [ ] 7.3 乗車履歴とフィードバック送信を実装する
  - 乗車セッションの履歴を端末内にのみ保存する
  - 乗車終了時に 3 択（最初から座れた/途中から/最後まで立ち）と着座駅選択、任意の予測差回答を 2 タップ程度で送信できるフローを実装する
  - 送信時にフィードバックが予測改善に使われる旨を表示し、乗車中のみ有効な匿名 Trip ID とのみ関連付けて送信する
  - 完了条件: フィードバック送信が 2 タップで完了し、受付 API に匿名ペイロードのみが記録される
  - _Depends: 3.3, 7.1_
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 16.1, 16.2_

- [ ] 8. 保存ルート・通知・レポート
- [ ] 8.1 (P) 通勤ルート保存を実装する
  - 出発駅・到着駅・曜日・出発時刻・快適性優先度を含む保存と一覧を実装する
  - Free は 1 件制限とし、2 件目の保存試行で Paywall トリガーを発火、Pro は複数保存を許可する
  - 保存済みルートのタップで保存条件による即時検索を実行する
  - 削除時に取り消し（Undo）手段を提供する
  - 完了条件: Free で 2 件目保存時に Paywall が表示され、保存ルートのタップから検索結果が表示される
  - _Depends: 5.4, 6.2_
  - _Boundary: SavedRoutesStore_
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 8.2 (P) スマート通知クライアントを実装する
  - 利用目的の事前説明付きで通知許可を要求し、拒否されても他機能を維持する
  - push トークンの取得と通知登録の作成/削除、頻度・時間帯設定画面を実装する
  - 通知タップで該当ルートの比較画面へディープリンク遷移する
  - 完了条件: 登録済み端末に届いたテスト通知のタップで該当ルートの比較画面が開く
  - _Depends: 3.6_
  - _Boundary: PushRegistration_
  - _Requirements: 1.3, 10.1, 10.4, 10.5_

- [ ] 8.3 (P) 週間レポートを実装する
  - 週単位の合計立ち時間・削減できた予想立ち時間・快適ルート選択回数・予測精度の表示を実装する
  - 日別の予想立ち時間推移の可視化と、週切替時の前週比較を実装する
  - Free ではレポート詳細部分を Pro 案内付きで制限する（詳細レポートのゲートを本タスクが所有）
  - 完了条件: 端末内履歴から週次指標が集計表示され、Free では詳細部分に Pro 案内が表示される
  - _Depends: 6.2, 7.3_
  - _Boundary: WeeklyReport_
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.4_

- [ ] 9. オンボーディング・設定・公開品質
- [ ] 9.1 (P) オンボーディングを実装する
  - 3 画面以内で価値（快適ルート・予想立ち時間・プライバシー保護)を説明するフローを実装する
  - 「席を予約・確保するサービスではない」ことを明示する
  - 位置情報・通知の許可要求前に利用目的を表示し、拒否されても基本のルート検索を利用可能に保つ
  - 完了時にフラグを保存し、以後はホーム画面を直接表示する
  - 完了条件: 初回起動でオンボーディングが表示され、完了後の再起動ではホームが直接表示される
  - _Boundary: Onboarding_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 9.2 (P) 設定ハブとプライバシー管理を実装する
  - 言語・通知・位置情報・データ共有・履歴削除・サブスクリプション管理・プライバシーポリシー・利用規約への導線を設定画面に集約する
  - データ共有範囲の選択と、移動履歴の削除実行・完了表示を実装する（アカウントレスにおけるデータ削除導線）
  - 降車予定駅・身体情報に相当するデータを他ユーザーへ公開する経路が存在しないことを確認する
  - 完了条件: 履歴削除の実行で端末内履歴が消え完了が表示され、全導線が遷移可能である
  - _Depends: 7.3_
  - _Boundary: Settings_
  - _Requirements: 16.4, 16.5, 16.6, 16.7, 18.1, 18.2_

- [ ] 9.3 (P) 帰属表示とサポート導線を実装する
  - 外部データ提供元（ODPT 等）の利用条件に基づく帰属（クレジット）表示画面を実装する
  - サポート連絡先への導線を備える
  - 完了条件: 設定からクレジット表示とサポート導線へ遷移できる
  - _Boundary: Licenses_
  - _Requirements: 18.2, 18.3_

- [ ] 10. 統合検証
- [ ] 10.1 ファネル計測の統合を確認する
  - オンボーディング完了・検索開始/完了・ルート選択（種別）・乗車開始・フィードバック送信・Paywall 表示（トリガー種別）・トライアル開始・購入完了/復元/失敗の全イベントが各トリガー箇所で送信されることを確認する
  - 完了条件: 一連の操作後、D1 上の SQL で「起動→検索→閲覧→選択→乗車→フィードバック→Paywall→購入」のファネルが再構成できる
  - _Depends: 4.5, 6.4, 7.3, 9.1_
  - _Requirements: 17.1, 17.2, 17.4_

- [ ] 10.2 Playwright による中核フローの自動 E2E を整備する
  - オンボーディング完了→再訪時非表示、検索→3 ルート比較→差分表示→詳細、Free の 4 回目検索での Paywall 表示（Pro モックでは非表示）のシナリオを実装する
  - 言語切替の即時反映、オフライン時のエラー表示・再試行、フィードバック 2 タップ送信 UI のシナリオを実装する
  - 課金はエンタイトルメント判定のモックで Free / Pro 両状態を切り替えて検証する（実課金はネイティブ実機 E2E の担当）
  - 完了条件: 全シナリオが CI 上でグリーンになり、PR ごとに自動実行される
  - _Depends: 4.6, 6.4, 7.3, 9.1_
  - _Requirements: 1.1, 1.5, 4.1, 8.4, 12.2, 14.3, 15.1, 18.6_

- [ ] 10.3 実機 E2E: 中核フローを検証する
  - オンボーディング→検索→3 ルート比較→詳細→フィードバックの主要フローを実機（dev build）で通しで動作させる
  - 機内モードでのオフライン表示と保存済み時刻表閲覧、言語切替の即時反映を確認する
  - 検索から 3 案表示までの応答時間（目標 1.5 秒以内）を実測する
  - 完了条件: 主要フローが実機で完走し、オフライン・言語切替・応答時間の確認結果が記録される
  - _Requirements: 14.3, 15.1, 15.2, 18.6_

- [ ] 10.4 sandbox 課金 E2E を検証する
  - sandbox で購入→Pro 即時解放→アプリ再起動での権利維持→「購入を復元」→購入キャンセル（非エラー）→期限切れで Free 相当へ戻ることを一連で確認する
  - 審査環境・本番ストア環境の双方で購入・復元・権利変更を確認可能な状態にする
  - 完了条件: 上記シナリオが dev build 実機で完走し、各状態遷移の確認結果が記録される
  - _Depends: 6.4_
  - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.8, 18.5_

## Implementation Notes

- **2.1**: D1 migrations live at `apps/backend/src/db/migrations/0001_init_schema.sql`, not
  `db/schema.sql` as design.md's File Structure Plan names it — `@cloudflare/vitest-pool-workers`'s
  `readD1Migrations()`/`applyD1Migrations()` (the only supported way to apply D1 migrations inside
  this test runner) require the standard `NNNN_name.sql` migrations-directory format. The same
  directory is wired as `d1_databases[].migrations_dir` in `wrangler.jsonc`, so
  `wrangler d1 migrations apply seatsignal-db --local` (`pnpm --filter backend db:migrate:local`)
  uses the identical files for real local dev.
- **2.1**: `.github/workflows/ci.yaml`'s backend typecheck job needs a `pnpm --filter backend cf-typegen`
  step before `tsc --noEmit` (mirroring the existing "Generate Expo environment types" step for
  frontend) — `apps/backend/tsconfig.json` now requires the generated (gitignored)
  `worker-configuration.d.ts` for `D1Database`/`KVNamespace`/`CloudflareBindings` types, and CI
  doesn't generate it yet. Not fixed as part of 2.1 because `.github/workflows/**` edits are denied
  by this repo's Claude Code permission settings — needs a human to apply this before merge, or CI's
  backend typecheck job will fail.
- **2.1**: `wrangler.jsonc`'s `d1_databases`/`kv_namespaces` IDs are placeholder zero-UUIDs (local
  Miniflare D1/KV testing doesn't require real Cloudflare-issued IDs). Before any real deploy, run
  `wrangler d1 create seatsignal-db` and `wrangler kv namespace create seatsignal-status-cache`
  against the target Cloudflare account and update the IDs — deliberately not run here since it
  creates live resources in a real, authenticated Cloudflare account.
- **2.2 — unresolved task-plan gap, needs a human decision**: design.md's "Modified Files" section
  (line 240) says `apps/backend/src/index.ts` should end up with a `scheduled` export and CORS, but
  task 2.2's own bullets don't ask for either, and 2.2 explicitly freezes `index.ts` for all
  subsequent "API タスク" (`以後の API タスクは自分のルートモジュールのみを変更し、アプリ組立て
ファイルには触れない`). Checked every task in section 3 (3.1–3.8): **none currently claims
  ownership of adding a `scheduled` export or CORS to `index.ts`.** This matters concretely because
  `wrangler.jsonc` already has daily/5-min Cron Triggers configured (task 2.1) with no handler to
  invoke them once deployed. Not fixed in 2.2 because it's outside that task's stated scope and
  because amending another approved task's `_Boundary:_`/text isn't something to do unilaterally
  mid-implementation. Suggested resolution (needs sign-off, not applied): add
  `_Boundary: index.ts (scheduled export only)_` to task 3.4 (the earliest cron-consuming task,
  daily aggregation) authorizing it to add the `scheduled` export and dispatch-by-cron-name to
  `index.ts`, with task 3.7 extending the same handler's switch rather than re-touching route/
  middleware assembly; CORS ownership is unassigned pending a decision on whether task 4.2 (frontend
  API client) or task 4.6 (Playwright E2E against Expo web, where CORS failures would first become
  observable) should carry a small explicit cross-boundary allowance for it.
- **2.3**: KV storage convention for datasets — `push-datasets-to-kv.ts` writes each dataset under
  key `dataset:{name}` (`dataset:timetable` / `dataset:congestion` / `dataset:correction`) in the
  `STATUS_CACHE` KV binding (the only KV binding declared in task 2.1; design.md line 514 names only
  one, so datasets and the ODPT status cache share it, differentiated by key prefix, not a second
  binding). The stored value is the JSON-stringified `{version, payload}` shape — i.e. exactly
  `createDatasetResponseSchema(...)`'s "payload" branch — so task 3.1's Datasets API can read
  `env.STATUS_CACHE.get(`dataset:${name}`)`, `JSON.parse` it, and compare its `version` against the
  request's `?since=` query param almost verbatim (return `{version, notModified: true}` on match,
  the parsed value as-is otherwise). Congestion coverage intentionally spans every weekday
  morning+evening time bucket the sibling timetable dataset offers (07:00-08:00, 18:00-19:00) to
  satisfy requirements.md 5.8's "対象区間の全提供時間帯"; no weekend data is seeded since weekend is
  outside the approved "平日朝夕" MVP scope cut. `correction.json` seeds `stats: []` (no feedback
  exists pre-launch) rather than fabricated data.
- **3.1**: Implemented exactly per the 2.3 storage convention above — `datasets.ts` reads
  `dataset:{name}` from `STATUS_CACHE`, 404s if absent, and compares `?since=` to the stored
  `version` for the `notModified`/`payload` branch. No spec conflict, no scope beyond the task text.
- **3.2**: requirements.md/design.md never define (a) a mapping from our internal `railwayId` (single-
  line MVP scope, `RAIL_CHUO` per 2.3) to ODPT's own `odpt.Railway:*` resource identifiers, or (b)
  ODPT's `odpt:TrainInformation` response shape. Resolved locally in
  `apps/backend/src/services/odpt-client.ts` rather than blocking: a small `ODPT_RAILWAY_IDS` map
  (currently just `RAIL_CHUO`) — any other `railwayId` short-circuits to 404 `not_found` without
  calling ODPT; `odpt:trainInformationStatus.ja` text is pattern-matched for 平常/見合わせ/運休, with
  delay minutes parsed from `odpt:trainInformationText` via `/(\d+)\s*分/`. Revisit this mapping and
  the field-matching heuristic against a real ODPT response before production traffic — it was never
  exercised against the live API, only against mocked `fetch`. Cache design uses two `STATUS_CACHE`
  keys per railway: `train-status:fresh:{id}` (60s TTL, drives the cache-hit branch) and
  `train-status:last:{id}` (no TTL, last-known-good value served with `stale: true` on ODPT failure)
  — needed because a single 60s-TTL key can't serve both "skip ODPT within 60s" and "fall back after
  the entry expires or ODPT errors" at once. Error responses reuse shared's 5-entry `ErrorCode` enum
  (no dedicated not-found code exists): `http_error` for 404/502, `unknown` for the defensive 500
  catch-all. Gotcha for anyone adding Workers-runtime fetch mocks: build the mocked `Response` inside
  `vi.spyOn(globalThis,"fetch").mockImplementation(async () => ...)`, not via a `Response` built
  earlier and handed to `mockResolvedValue` — a pre-built one belongs to the outer test's IoContext
  and throws ("Cannot perform I/O on behalf of a different request") when its body is read inside the
  `SELF.fetch`-triggered request. Also: KV state is **not** isolated per `it()` in this project's
  `@cloudflare/vitest-pool-workers` config — tests must explicitly clear the keys they depend on in
  `beforeEach` (see `apps/backend/test/routes/datasets.test.ts` / `train-status.test.ts`) or state
  leaks across tests in the same file.
- **3.3**: `feedback.ts` derives `day_type` server-side via shared's `toDayType(new Date())` since the
  client payload has no such field (matches task 1.1's stated intent: this helper is "feedback/予測/
  集約で共用"). The "reject a payload with identifier/location fields" completion condition is
  satisfied structurally by `feedbackPayloadSchema` being a zod `strictObject`-based
  `discriminatedUnion` (unknown keys are rejected by the schema itself, not by hand-written
  stripping) — the integration test only asserts a non-200 status for such payloads, not the exact
  error body shape, since OpenAPIHono's default validation-error hook doesn't yet emit this backend's
  `{error:{code}}` shape (same pre-existing, cross-cutting, not-yet-owned gap noted for 3.1/3.2).
  `test/index.test.ts`'s existing feedback rate-limit test now expects `200` instead of `501` for the
  first 30 requests, and gained a `beforeAll(applyD1Migrations(...))` since `/v1/feedback` performs
  real D1 writes now.
- **3.4**: requirements.md/design.md never define a numeric formula for turning a feedback row into
  `correction_stats.delta_score` or `metrics.mae_standing_min` — feedback only carries a categorical
  `seatedOutcome` and an optional categorical `vsExpected` (less/as/more crowded than predicted),
  never a numeric "actual standing minutes". Resolved in `services/feedback-aggregator.ts`: `vsExpected`
  is the sole signal (it's the purpose-built calibration answer, Req 8.3/8.5), mapped to
  `-0.1 / 0 / +0.1` (rows without it contribute `0` -- "no reported deviation" -- but still count
  toward the cell's sample size); `delta_score` is the per-cell mean of that signal, and
  `mae_standing_min` reuses the *same* signal (mean of `|value| * STANDING_MINUTES_SCALE`), so it
  actually reports "average magnitude of reported crowding-perception deviation, in minutes", not a
  literal measured standing-time error -- revisit once feedback captures a real duration.
  `runAggregateFeedback` (`cron/aggregate-feedback.ts`) is a directly-callable, directly-tested
  function, deliberately **not** wired into `index.ts`'s (nonexistent) `scheduled` export — that gap
  was already flagged as unresolved and needing human sign-off in task 2.2's Implementation Note
  above, and remains unresolved; this task only implements and proves the aggregation *logic*, which
  is all its own completion condition requires. `correction_stats` is fully cleared
  (`deleteAllCorrectionStats`) before each rebuild rather than only upserted, so a cell that drops
  below the n>=5 threshold between runs doesn't leave a stale row -- genuine "全量再計算". Batch order
  is fetch-within-retention → rebuild correction_stats → record MAE → delete expired feedback
  (deletion last, so aggregation never has to reason about soon-to-be-deleted rows). The `metrics.date`
  value uses `now.toISOString().slice(0,10)` (UTC) with no explicit JST conversion; this is only
  correct because the cron fires at 18:00 UTC (= 03:00 JST the next day per `wrangler.jsonc`), so
  `now`'s UTC calendar date already equals the JST day being summarized for this *specific* schedule
  — if the trigger time ever changes, this needs revisiting. `metrics.railwayId` is taken from an
  arbitrary feedback row rather than tracked per railway, correct only under the single-railway MVP
  scope already baked into `metrics`' schema (PK is `date` alone) — revisit together when a second
  railway is onboarded.
- **3.5**: `postEventsRequestSchema`'s `events` array is deliberately unbounded (no `.max(20)`) so a
  >20 batch reaches the route handler instead of failing schema validation with a 400 -- the handler
  itself checks `events.length` and returns the task-required `413`, not `400`. `analytics_events.
  created_at` stores the client-supplied `occurredAt` verbatim (schema-validated as `z.iso.datetime()`
  only, no bounds check), not a server-received timestamp -- reasoning: it's the semantically correct
  "when it happened" for funnel time-series (17.3/17.4), but a malicious/buggy client could skew that
  series with a back/future-dated event; revisit if analytics integrity ever needs hardening. The
  per-event insert loop is not transactional (no transaction helper exists anywhere in `queries.ts`
  to reuse) -- a mid-batch D1 failure leaves prior events committed and returns 500 with no rollback;
  acceptable for this task's scope (its completion condition only covers accepted-count/schema-
  rejection/413, not partial-failure atomicity), but a future task touching this path should know.
- **3.6**: `deletePushRegistration` (`db/queries.ts`) now returns `Result<number, AppError>` (the D1
  `meta.changes` count) instead of `Result<void, AppError>`, mirroring the exact pattern already used
  for `deleteExpiredFeedback` in 3.4 -- needed so the DELETE route can tell "row existed and was
  removed" (200) from "no such row" (404). Its one pre-existing caller (`test/db/queries.test.ts`)
  only asserted `isOk(...)`, never `.data`, so this was a compatible widening, not a breaking change.
  PUT always resets `last_sent_date` to `null` on every upsert, including no-op resubmissions of an
  identical body -- intentional (a schedule change should let the registration fire again even if
  today's send already happened), but **task 3.7** should know: once its cron sets `last_sent_date`
  for dedup, a client re-PUTing an *unchanged* registration after today's notification already fired
  would reset that flag and could cause a same-day duplicate send. Not testable yet since no
  `last_sent_date` producer exists before 3.7.
