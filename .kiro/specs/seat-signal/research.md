# Research & Design Decisions — seat-signal

---
**Purpose**: 技術設計（design.md）の根拠となるディスカバリ結果・調査ログ・設計判断を記録する。
---

## Summary
- **Feature**: `seat-signal`
- **Discovery Scope**: New Feature / Complex Integration（グリーンフィールド。既存コードは Expo テンプレート＋Hono スキャフォールドのみ）
- **Key Findings**:
  - ODPT（公共交通オープンデータセンター）は無償の開発者登録で商用利用可。API v4（`odpt:TrainTimetable` / `odpt:StationTimetable` / `odpt:Train` 等）。アクセストークン必須のため**クライアントへ直接埋め込めず、Workers 経由のプロキシ／事前スナップショット配信が必要**。ライセンス上の帰属（クレジット）表示が必要（Req 18.3 と整合）
  - RevenueCat `react-native-purchases` 10.6.0 / `react-native-purchases-ui` 10.6.0 は**ネイティブモジュールのため Expo Go では動作せず、`expo-dev-client` + EAS ビルドが必須**（Expo Go では Preview API Mode のモックになる）。Paywall UI はダッシュボード構成の `react-native-purchases-ui` を採用可能
  - プライバシー要件（16.1「個人向け計算は端末内」）と決定性要件（5.2「同一条件で同一予測」）は、**予測をルールベース＋事前配布データセットで端末内実行**するアーキテクチャで同時に満たせる。サーバは匿名フィードバックの集約統計とデータセット配信のみを担う

## Research Log

### ODPT（時刻表・運行情報データ）
- **Context**: Req 3（ルート検索）、7.3（遅延検知）、15.2（オフライン時刻表）、18.3（帰属表示）の実現手段
- **Sources Consulted**: odpt.org（協議会・センター概要）、ckan.odpt.org データカタログ、開発者向け API ドキュメント（api.odpt.org / api-public.odpt.org）
- **Findings**:
  - 開発者登録（無償）でアクセストークンを取得し、API v4 を利用。商用利用可（旧 Tokyo Metro API との主要な差分）
  - 静的データ: `odpt:TrainTimetable`（列車時刻表）、`odpt:StationTimetable`、`odpt:Station`、`odpt:Railway`。準リアルタイム: `odpt:Train`（在線）、`odpt:TrainInformation`(運行情報)
  - 利用規約への準拠と帰属表示が必要。再配布条件はデータセットごとに確認が必要（Adjacent expectation として requirements に記載済み）
- **Implications**:
  - トークン秘匿のため ODPT へは **backend（Workers）からのみアクセス**する（security.md: シークレットをクライアントへ置かない）
  - 時刻表は毎リクエスト取得ではなく、**バージョン付きデータセット・スナップショット**として整形・配信し、クライアントが SQLite にキャッシュ → オフライン閲覧（15.2）と決定性（5.2）を担保
  - 運行情報（遅延）のみ Workers プロキシ（KV キャッシュ、TTL 60s 程度）で準リアルタイム取得

### RevenueCat SDK × Expo
- **Context**: Req 12（Paywall）、13（購入・復元）。ハッカソン規約で RevenueCat 必須
- **Sources Consulted**: revenuecat.com/docs/getting-started/installation/expo、RevenueCat/react-native-purchases（GitHub）、RevenueCat Expo チュートリアル（2026-06 更新）、npm view
- **Findings**:
  - `react-native-purchases@10.6.0` / `react-native-purchases-ui@10.6.0`（npm 実測、2026-08-04）
  - Expo Go 非対応（ネイティブコード）。`npx expo install expo-dev-client react-native-purchases react-native-purchases-ui` → EAS development build が必要
  - Paywall はダッシュボードでテンプレート構成し `RevenueCatUI.presentPaywall()` / `<RevenueCatUI.Paywall>` で表示可能。Offering / Package / Entitlement モデル
  - `Purchases.getCustomerInfo()` はキャッシュを持ち、起動時の権利自動復元（13.5）は SDK 標準動作。`restorePurchases()` で明示復元（13.4）。ユーザーキャンセルは `userCancelled` フラグで判別（13.6）
- **Implications**:
  - entitlement 識別子は `pro` の 1 つに集約。クライアントは CustomerInfo の entitlement 有無だけを参照（レシート検証・状態管理は RevenueCat 側 — Adjacent expectation と整合）
  - 開発フローが「Expo Go で UI 開発 → dev build で課金検証」の 2 段になる。課金モジュールは Preview API Mode でもクラッシュしないよう境界を分離する

### 通知配信方式（Req 10）
- **Context**: 「保存通勤時刻の 15〜30 分前に予測を計算して通知」— 天候・遅延を反映するには配信時点の計算が必要
- **Sources Consulted**: expo-notifications ドキュメント、Expo Push API、Cloudflare Workers Cron Triggers
- **Findings**: iOS のローカル通知は事前スケジュールのみで配信時点の再計算が不可。バックグラウンドフェッチは iOS では実行保証がない
- **Implications**: **Workers Cron Trigger（5 分間隔）→ 対象時刻の保存ルートを D1 から抽出 → 予測計算 → Expo Push API 送信**のサーバプッシュ方式を採用。D1 に保存するのは push トークン・駅ペア・時刻・優先度のみ（16.1 / 17.5 のデータ最小化と整合）

### 分析・クラッシュ計測（Req 15.4 / 17）
- **Context**: ファネル計測とクラッシュ検知。外部 SaaS か自前か
- **Findings**: `@sentry/react-native@8.21.0` は Expo config plugin 対応でクラッシュ検知（15.4）に十分。ファネル分析は要件が「運用者が測定可能」レベルで、イベント種別・プロパティが明確に定義済み（17.1–17.4）
- **Implications**: クラッシュ = Sentry を採用。プロダクト分析 = **自前の軽量イベント収集（Workers `/v1/events` → D1）**を採用。外部分析 SaaS を増やさずデータ最小化（17.5）を構造的に保証でき、ハッカソンのデモでも SQL で直接ファネルを示せる

### クライアント基盤ライブラリ（npm 実測 2026-08-04）
- **Findings**: expo `~57.0.9` / RN `0.86.2` / React `19.2.3`（既存）。追加候補: `expo-sqlite@57.0.1`（データセットキャッシュ・kv-store）、`expo-notifications@57.0.8`、`expo-localization@57.0.1`、`i18next@26.3.6`、`zustand@5.0.14`、`@tanstack/react-query@5.101.4`、`zod@4.4.3`、`@sentry/react-native@8.21.0`
- **Implications**: すべて Expo SDK 57 系と互換のメジャー最新。バージョンは実装時に `npx expo install` の推奨解決を優先する

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| サーバ集中型（予測 API） | 検索・予測をすべて Workers で計算 | クライアント薄い、モデル更新が容易 | 検索条件（移動履歴に相当）がサーバへ渡り 16.1 と衝突。オフライン不可。決定性の保証が配信タイミング依存 | 不採用 |
| **端末内計算＋データセット配信（採用）** | 予測・検索はデバイス内。サーバはデータセット版管理・匿名フィードバック集約・通知のみ | 16.1/5.2/15.2 を構造的に満たす。Workers 側が薄く高速に作れる | データセット更新の配信管理が必要。端末側ロジックのテスト必須 | feature-sliced なクライアント層構造と併用 |
| フルローカル（サーバなし） | データセット同梱・フィードバックもローカルのみ | 最小工数 | 8.8（コミュニティ補正）、10（サーバプッシュ）、5.9（誤差測定）が満たせない | 不採用 |

クライアント内部は **feature-sliced**（`features/<domain>` に UI・hooks・logic を同居、共通基盤は `lib/`）とし、依存方向を `types → lib → features → app(routes)` に固定する。

## Design Decisions

### Decision: 予測・検索エンジンを端末内実行、サーバはデータ配信と集約に限定
- **Context**: 16.1（端末内計算・履歴非保存）と 5.2（決定性）、15.2（オフライン）、17.5（位置情報を送らない）
- **Alternatives Considered**: 1) 予測 API をサーバに置く 2) 完全ローカル
- **Selected Approach**: バージョン付きデータセット（時刻表・混雑プロファイル・補正統計）を Workers から配信し、クライアントが SQLite に格納して検索・予測を実行
- **Rationale**: プライバシー・決定性・オフラインの 3 要件を同一機構で満たす。対象区間が 1〜3 路線に限定されるためデータ量・計算量とも端末内で十分
- **Trade-offs**: データセットのビルド・版管理パイプラインが必要（運用スクリプト化で吸収）
- **Follow-up**: データセットサイズ実測（目標 < 5MB）、SQLite クエリの検索応答実測

### Decision: 混雑予測はルールベーススコアリング（ML 不使用）
- **Context**: Out of scope に「機械学習による完全自動予測」。5.6（使用要素のみで理由説明）、5.8（初期から全時間帯提供）
- **Selected Approach**: `基礎混雑プロファイル（路線×駅区間×時間帯×曜日種別×号車） + 補正項（天候・イベント・遅延・フィードバック集約統計）` の加算型スコア。各項の寄与を保持して理由説明を生成
- **Rationale**: 決定的・説明可能・事前整備データのみで初期提供可能。補正項の追加で漸進改善できる
- **Trade-offs**: 精度の上限はプロファイル整備の質に依存 → 8.8 のフィードバック補正で補う
- **Follow-up**: 信頼度閾値（レンジ表示切替 5.4）の初期値をフィールド調査で校正

### Decision: RevenueCat をクライアント SDK 完結で採用（バックエンド検証なし）
- **Context**: Req 12/13。Adjacent expectation「課金処理は課金プラットフォームに委ねる」
- **Alternatives Considered**: 1) RevenueCat Webhook を Workers で受けて権利をサーバ管理 2) クライアント SDK のみ
- **Selected Approach**: クライアント SDK（`react-native-purchases` + `-ui`）のみ。entitlement `pro` を唯一の判定点とし、`SubscriptionGate` に集約
- **Rationale**: 本アプリの Pro 機能はすべてクライアント側機能で、サーバ側で守るべき有償リソースがない。Webhook 連携は工数増に見合わない
- **Trade-offs**: 無料枠制限（1 日 3 回）はクライアント側カウントとなり改ざん耐性は低い — MVP では許容（リスクとして記録）
- **Follow-up**: サーバ側有償機能が生まれた時点で Webhook + D1 権利キャッシュへ拡張

### Decision: 通知はサーバプッシュ（Workers Cron + Expo Push）
- **Context**: 10.1–10.3 は配信時点の予測計算（天候・遅延反映）が必要。iOS ローカル通知では実現不可
- **Selected Approach**: 通知オプトイン時のみ、匿名 device 単位で push トークン＋駅ペア＋通知時刻を D1 登録。Cron（*/5）で該当ウィンドウを抽出し予測計算 → Expo Push 送信
- **Trade-offs**: サーバが唯一「ユーザーのルート情報」を持つ箇所になる → 保存項目を駅ペア・時刻・優先度に限定し、ユーザー ID とは無関係のランダム registration ID で管理（16.1 の「恒久的な移動履歴」に該当しない設計）
- **Follow-up**: 通知オフ時の登録削除 API、トークン失効時のクリーンアップ

### Decision: 分析イベントは自前収集（Workers → D1）、クラッシュは Sentry
- **Context**: Req 17 のファネル・プロパティ定義が明確で、17.5 のデータ最小化が強い制約
- **Rationale**: 送信スキーマを zod で固定すれば「必要最小限」を型で強制できる。外部 SaaS 追加より審査・プライバシー表記も単純
- **Trade-offs**: ダッシュボードは SQL 手組み — ハッカソン規模では許容

### Synthesis 結果（Generalization / Simplification）
- **一般化**: 「Paywall 表示トリガー」（12.2 検索上限 / 12.4 Pro 機能 / 9.3 保存 2 件目）は単一の `PaywallTrigger` 型と `SubscriptionGate` インターフェースに統合。「予測の提示」（4.2 比較 / 5.x 詳細 / 6.2 駅ごと / 7.2 コーチ / 10.2 通知）は単一の `PredictionResult` 型を全画面で共有
- **簡素化**: 天候・イベントデータの外部 API 連携は MVP ではデータセット内の静的補正係数（データセットビルド時に付与）とし、クライアントからの天気 API 呼び出しは持たない。号車データはドア単位を持たず号車単位のみ（6.3 準拠）

### Decision: packages/shared の責務拡張（設計レビューでの改訂 2026-08-04）
- **Context**: 当初は「API 契約型（zod スキーマ）のみ」に限定していたが、設計検証時のユーザー指示により拡張
- **Selected Approach**: shared に zod スキーマに加えて、ドメイン定数（予測係数・プラン制限・保持期間）、エラーコード／messageKey マップ／AppError／Result 型、予測スコアリング純粋関数、共通ユーティリティ（時間バケット・zod パースヘルパ）を集約
- **Rationale**: 予測式・エラー語彙・制限値はクライアント/サーバ双方で使われ、二重実装すると乖離事故（特に通知の予測 10.2 とアプリ内予測の不一致）が起きる。単一定義が構造的に安全
- **Trade-offs / Constraint**: shared は**純粋 TypeScript のみ**（依存は zod だけ。RN / Node / Workers API の import 禁止）。エラー文言の実体は i18n 対応のため locales 側に置き、shared はコード → messageKey のマップに留める
- **Follow-up**: 実装時に tsconfig / knip で shared のプラットフォーム依存混入を検査

### Decision: OpenAPI 仕様書を zod から自動生成（設計レビューでの追加 2026-08-04）
- **Context**: ユーザーが API 検証に Postman を使用するため、インポートしてすぐ使える精度の `openapi.yaml` を要求
- **Alternatives Considered**: 1) openapi.yaml を手書きで整備 2) `@hono/zod-openapi` でルート定義から自動生成
- **Selected Approach**: `@hono/zod-openapi@1.5.1`（npm 実測。peer: hono >=4.10 / zod ^4.0 — 現行スタックと互換）を採用。backend を `OpenAPIHono` で構成し、`scripts/generate-openapi.ts` が `apps/backend/openapi.yaml`（OpenAPI 3.0）を生成・コミット。dev では `GET /doc` でも配信
- **Rationale**: 手書き仕様書は実装とのドリフトが必然。zod スキーマを単一の真実とし、生成物の一致をテストで強制することで「Postman で常に正しい」状態を維持できる
- **Trade-offs**: shared スキーマに example/description メタデータの付与が必要（zod 4 ネイティブ `.meta()` を使用し shared の純粋性を維持）。生成スクリプトの保守が増えるが手書き同期コストより小さい
- **Follow-up**: Postman への実インポート確認を E2E チェックリストに追加。OpenAPI 同期テスト（生成物 vs コミット済み yaml）を CI に組み込む

## Risks & Mitigations
- ODPT の再配布条件がデータセット配信方式と衝突する可能性 — 利用登録時にライセンス確認し、抵触時は「Workers が都度整形して返す API」形式へ切替（クライアント境界は Repository 層で吸収）
- 無料枠制限のクライアント側実装は改ざん可能 — MVP では許容し、kv-store に日付付きカウンタ保存。将来サーバ検証へ移行可能な様に `UsageLimiter` を独立モジュール化
- Expo Go で課金モジュールが動かない — Preview API Mode を利用し、entitlement 判定を `SubscriptionGate` に集約してモック切替可能にする
- 混雑プロファイル初期整備の工数 — 対象を最小 1 路線・乗換なし区間から開始できる要件（Introduction）に合わせ、データセットスキーマは路線数非依存に設計
- D1 への書込集中（イベント収集） — バッチ送信（クライアント側で最大 20 件/フラッシュ）+ `waitUntil` 非同期書込で吸収

## References
- [公共交通オープンデータセンター](https://www.odpt.org/overview/) — 利用登録・提供データ概要
- [ODPT データカタログ（CKAN）](https://ckan.odpt.org/) — TrainTimetable 等のデータセットとライセンス確認
- [RevenueCat Expo Installation](https://www.revenuecat.com/docs/getting-started/installation/expo) — dev build 必須、インストール手順
- [RevenueCat Expo チュートリアル（2026）](https://www.revenuecat.com/blog/engineering/build-a-single-expo-app-with-subscriptions-on-ios-android-and-web-using-revenuecat) — Paywall UI / Offering 構成
- [react-native-purchases GitHub](https://github.com/RevenueCat/react-native-purchases) — SDK API リファレンス
- [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) — 通知スケジューラの実行基盤
