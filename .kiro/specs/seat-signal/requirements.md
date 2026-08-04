# Requirements Document

## Project Description (Input)

SeatSignal — 最速ではなく「最も快適に移動できるルート」を提案する AI 通勤アシスタント。

時刻表・乗降傾向・天候・イベント・匿名ユーザーフィードバックを組み合わせ、ユーザーごとの予想立ち時間（Expected Standing Minutes）と移動負担を最小化する。席そのものを予約・確保するサービスではなく、座れる可能性と移動負担を予測し、より快適な行動を支援するサービス。

RevenueCat Shipaton 2026 への提出作品として、期間内にストア公開・サブスクリプション課金（SeatSignal Pro）までを実現する。

## Introduction

SeatSignal は、公共交通機関の経路検索に「快適性」という新しい選択基準を追加するモバイルアプリである。既存の経路検索が最適化する「到着時間」ではなく、移動全体の**予想立ち時間**を中核指標とし、「最速」「バランス」「最も快適」の 3 ルートを比較提示する。選択したルートに対しては推奨号車・乗車位置を案内し、乗車後も予測を更新して案内する（Live Comfort Coach）。乗車結果のフィードバックを匿名で収集し、予測精度を継続的に改善する。

MVP の検証仮説は「ユーザーは、最速ルートとの差分時間と削減できる予想立ち時間が明示されれば、数分遅い快適ルートを選択する」である。対象は東京の事前定義した対象区間（1〜3 路線。最小 1 路線・乗換なし区間でも価値検証が成立する構成とする）、平日に電車で通勤・通学するユーザー、iOS 優先、日本語・英語対応とする。

収益化はサブスクリプション（SeatSignal Pro：月額 ¥680 / 年額 ¥5,400、7 日間無料トライアル）で行う。ハッカソン規約により課金基盤には RevenueCat を使用することが外部制約として決まっている（課金機能の内部実装方式は設計フェーズで扱う）。

## Boundary Context

- **In scope**: オンボーディング、快適性プリファレンス、対象区間のルート検索、3 ルート比較、予想立ち時間・着座予測の提示（信頼度・理由付き）、ルート詳細・号車/乗車位置案内、乗車結果フィードバック、Free/Pro プランと Paywall、購入・復元、通勤ルート保存、スマート通知、Live Comfort Coach、週間レポート、日英切替、オフライン/低データ/エラー状態の表示、プライバシー管理、運用者向け計測、ストア公開品質
- **Out of scope**（今回明確に実装しない）: 席の予約・売買、個人単位の降車予測（「目の前の人が降りる」等）、座席単位のリアルタイム空席マップ、東京全路線・複数都市対応、リアルタイム号車別混雑データの取得を前提とする機能、機械学習による完全自動予測、ゼロ知識証明等の高度な暗号プライバシー基盤
- **Adjacent expectations**:
  - 時刻表・運行情報は公共交通オープンデータ（ODPT 等）の提供継続に依存する。外部データの利用は、提供元への利用登録とライセンス条件（商用利用・帰属表示・再配布制限）の確認完了を前提とする
  - 課金処理・レシート検証・サブスクリプション状態管理は課金プラットフォームに委ね、本システムはその結果（entitlement）を参照する
  - ストア審査・配布はアプリストアの規約とプロセスに従う（審査リードタイムを考慮した提出計画は運用側の責務）
  - 号車別のリアルタイム混雑データは提携なしでは入手できない前提とし、予測は事前整備した混雑プロファイル・実走調査・ユーザーフィードバックで構成する

## Requirements

### Requirement 1: オンボーディング

**Priority:** Must
**Objective:** 初回ユーザーとして、SeatSignal の価値とデータの扱いを短時間で理解したい。それにより、安心して利用を開始できる。

#### Acceptance Criteria

1. When ユーザーがアプリを初回起動する, the SeatSignal shall 3 画面以内でプロダクトの価値（快適ルート・予想立ち時間・プライバシー保護）を説明するオンボーディングを表示する
2. The SeatSignal shall オンボーディング内で「席を予約・確保するサービスではない」ことを明示する
3. When 位置情報または通知の許可を要求する, the SeatSignal shall 許可要求の前に利用目的を表示する
4. If ユーザーが位置情報・通知の許可を拒否する, the SeatSignal shall 基本のルート検索機能を利用可能なまま維持する
5. When ユーザーがオンボーディングを完了する, the SeatSignal shall オンボーディングを再表示せずホーム画面を表示する

### Requirement 2: 快適性プリファレンス設定

**Priority:** Must
**Objective:** ユーザーとして、速さと快適さの優先度を自分で設定したい。それにより、自分に合ったルートが提案される。

#### Acceptance Criteria

1. The SeatSignal shall 「速さ優先 ↔ 快適さ優先」の優先度設定（速さ重視/バランス重視/快適さ重視）を提供する
2. The SeatSignal shall 許容できる追加移動時間の設定を提供する
3. When ユーザーがプリファレンスを変更する, the SeatSignal shall 次回以降の検索結果のルート順位へ変更を反映する
4. The SeatSignal shall 身体的事情の直接入力を求めず、移動上の希望（立ち時間・乗換・歩行の許容度）として設定を受け付ける

### Requirement 3: ルート検索（対象区間）

**Priority:** Must
**Objective:** 通勤者として、出発駅・到着駅・時刻を指定して検索したい。それにより、対象区間の快適ルート候補を得られる。

#### Acceptance Criteria

1. When ユーザーが出発駅・到着駅・出発時刻を指定して検索する, the SeatSignal shall 対象区間内であればルート候補を返す
2. If 指定区間が対象範囲外である, the SeatSignal shall 未対応区間であることを明確に表示する
3. If 検索結果が取得できない, the SeatSignal shall エラー内容と再試行手段を表示する
4. The SeatSignal shall 最近使った検索条件を再利用できるようにする
5. While ルート計算中である, the SeatSignal shall 計算中であることを示すローディング表示を行う

### Requirement 4: 3 ルート比較

**Priority:** Must
**Objective:** ユーザーとして、最速・バランス・最も快適の 3 案を一画面で比較したい。それにより、時間と快適性のトレードオフを自分で選べる。

#### Acceptance Criteria

1. When 検索が完了する, the SeatSignal shall 「最速」「バランス」「最も快適」の 3 ルートを表示する
2. The SeatSignal shall 各ルートに到着予定時刻・所要時間・最速との差分時間・予想立ち時間・予想着座時間・着座確率・乗換回数・快適性スコア・予測信頼度を表示する
3. When ユーザーが快適ルートを選択する, the SeatSignal shall 「追加 N 分で予想立ち時間を M 分削減」の形式で最速ルートとの差分を表示する
4. The SeatSignal shall 3 案の比較を 1 画面内で完結して閲覧できるようにする

### Requirement 5: 予想立ち時間・着座予測の提示

**Priority:** Must
**Objective:** ユーザーとして、信頼度と理由の付いた予測を見たい。それにより、予測を納得して行動に移せる。

#### Acceptance Criteria

1. The SeatSignal shall すべての候補ルートに予想立ち時間を表示する
2. When 同一条件で再検索する, the SeatSignal shall 再現性のある同一の予測結果を返す
3. If 予測に使える実測データが少ない, the SeatSignal shall 予測信頼度を低として明示し、データ件数の目安を表示する
4. If 予測信頼度が定められた閾値を下回る, the SeatSignal shall 予想立ち時間を単一の数値ではなく幅（レンジ）を持たせた表現で表示する
5. The SeatSignal shall 予測値を断定表現ではなく確率・見込みとして表示する
6. The SeatSignal shall 予測結果に、モデルが実際に使用した要素のみに基づく理由説明を添える
7. If 理由を説明できるデータがない, the SeatSignal shall 「データ不足」である旨を表示する
8. The SeatSignal shall リリース時点から、ユーザーフィードバックの蓄積を前提とせず、事前に整備した混雑プロファイルに基づく予測を対象区間の全提供時間帯で提供する
9. The SeatSignal shall 予想立ち時間と実測値（フィードバック）の誤差を運用者が測定できるようにする

### Requirement 6: ルート詳細・乗車位置案内

**Priority:** Must
**Objective:** ユーザーとして、どの列車のどこに乗ればよいかを知りたい。それにより、ホーム到着後に迷わず待機できる。

#### Acceptance Criteria

1. When ユーザーがルートを選択する, the SeatSignal shall 利用列車・発車時刻・推奨号車・推奨乗車位置・推奨理由・予測信頼度を表示する
2. The SeatSignal shall 途中駅ごとの着座確率の変化を表示する
3. If ドア単位の信頼できるデータがない, the SeatSignal shall 架空の精度を提示せず号車または車両エリア単位の案内に限定する
4. The SeatSignal shall ホーム上の待機位置と進行方向を視覚的に表示する

### Requirement 7: Live Comfort Coach（乗車中ガイド）

**Priority:** Should
**Objective:** 乗車中のユーザーとして、状況変化に応じた最新の予測を受け取りたい。それにより、移動の最後まで最適な行動を選べる。

#### Acceptance Criteria

1. When ユーザーが乗車を開始する, the SeatSignal shall 現在駅・次の駅・残り駅数・現在の予想立ち時間を表示する
2. While 乗車セッションが有効である, the SeatSignal shall 駅ごとの着座確率と次の着座チャンスを自動更新する
3. When 遅延・運行情報の変化を検知する, the SeatSignal shall 予測を再計算して表示へ反映する
4. If 乗車中に位置情報が取得できない（地下区間等）, the SeatSignal shall 時刻表と経過時間に基づく駅進行の推定で案内を継続する
5. When 目的地への到着が近づく, the SeatSignal shall 降車を案内する
6. The SeatSignal shall 号車・エリア単位の集団統計として案内し、特定の個人の降車を予測する表現を用いない

### Requirement 8: 乗車結果フィードバック

**Priority:** Must
**Objective:** ユーザーとして、乗車結果を簡単に報告したい。それにより、次回以降の予測が改善される。

#### Acceptance Criteria

1. When 乗車が終了する, the SeatSignal shall 「最初から座れた」「途中から座れた」「最後まで立っていた」の選択肢を表示する
2. When ユーザーが「途中から座れた」を選択する, the SeatSignal shall 着座した駅の選択を受け付ける
3. The SeatSignal shall 「予測より空いていた/予測どおり/予測より混んでいた」の任意回答を受け付ける
4. The SeatSignal shall フィードバック送信を 2 タップ程度で完了できるようにする
5. When ユーザーが予測との差（予測より混んでいた等）を送信する, the SeatSignal shall フィードバックが今後の予測改善に使われることを明示する
6. When フィードバックが送信される, the SeatSignal shall 乗車中のみ有効な匿名 Trip ID とのみ関連付けて記録する
7. The SeatSignal shall 個人のフィードバック結果を他のユーザーへ公開しない
8. When フィードバックが蓄積される, the SeatSignal shall 以後の予測スコア補正へ反映する

### Requirement 9: 通勤ルート保存

**Priority:** Should（Free 1 件の保存自体は Must）
**Objective:** 通勤者として、よく使うルートを保存したい。それにより、毎日の検索と通知が自動化される。

#### Acceptance Criteria

1. The SeatSignal shall 出発駅・到着駅・曜日・出発時刻・快適性優先度を含む通勤ルートの保存を受け付ける
2. While 無料プランである, the SeatSignal shall 保存可能な通勤ルートを 1 件に制限する
3. When 無料プランのユーザーが 2 件目の保存を試みる, the SeatSignal shall Paywall を表示する
4. Where Pro プランが有効である, the SeatSignal shall 複数の通勤ルート（行き・帰り・曜日別）を保存できるようにする
5. When ユーザーが保存済みルートを選択する, the SeatSignal shall 保存条件で即座に検索を実行する
6. When ユーザーがルートを削除する, the SeatSignal shall 該当ルートを一覧から削除し、誤操作に対する確認または取り消し手段を提供する

### Requirement 10: スマート通勤通知

**Priority:** Should
**Objective:** 通勤者として、いつもの列車の混雑変化を事前に知りたい。それにより、アプリを開かなくても快適な選択ができる。

#### Acceptance Criteria

1. Where 通知が許可され通勤ルートが保存されている, the SeatSignal shall 保存された通勤時刻の 15〜30 分前に予測を計算して通知する
2. When いつもの列車が通常より混雑すると予測される, the SeatSignal shall 代替候補と削減できる予想立ち時間を含めて通知する
3. When 雨・イベント等により混雑増が予測される, the SeatSignal shall 変化の理由を含めて通知する
4. When ユーザーが通知を開く, the SeatSignal shall 該当ルートの比較画面へ遷移する
5. The SeatSignal shall 通知の頻度・時間帯をユーザーが設定できるようにする

### Requirement 11: 週間レポート

**Priority:** Should
**Objective:** ユーザーとして、自分の移動快適性の改善を数値で見たい。それにより、継続利用と Pro の価値を実感できる。

#### Acceptance Criteria

1. The SeatSignal shall 週単位で合計立ち時間・削減できた予想立ち時間・快適ルート選択回数・予測精度を表示する
2. The SeatSignal shall 日別の予想立ち時間の推移を可視化する
3. While 無料プランである, the SeatSignal shall レポートの詳細部分を Pro 案内付きで制限する
4. When 週が切り替わる, the SeatSignal shall 前週との比較を表示する

### Requirement 12: 無料プランの利用制限と Paywall

**Priority:** Must
**Objective:** 事業者として、価値体験後の適切なタイミングで課金導線を提示したい。それにより、無料ユーザーの体験を損なわず転換率を高める。

#### Acceptance Criteria

1. While 無料プランである, the SeatSignal shall 快適ルート検索を 1 日 3 回まで許可する
2. When 無料プランのユーザーが 4 回目の検索を実行する, the SeatSignal shall Paywall を表示する
3. While 無料プランである, the SeatSignal shall 3 ルート比較・基本的な予想立ち時間・基本着座確率・1 件の保存ルート・フィードバック送信を利用可能にする
4. When 無料プランのユーザーが詳細な号車・乗車位置案内、駅ごとの着座予測の全区間表示、Live Comfort Coach、または詳細レポートを開こうとする, the SeatSignal shall Paywall を表示する
5. The SeatSignal shall アプリ初回起動直後には Paywall を表示しない
6. The SeatSignal shall Paywall 上で無料プランと Pro の機能比較、および削減できた予想立ち時間などユーザーが得る価値を提示する

### Requirement 13: サブスクリプション購入・復元

**Priority:** Must
**Objective:** ユーザーとして、Pro を安心して購入・復元したい。それにより、すべての Pro 機能を継続的に利用できる。

#### Acceptance Criteria

1. The SeatSignal shall 月額プラン（¥680）と年額プラン（¥5,400、月あたり換算表示付き）を提示する
2. The SeatSignal shall 7 日間の無料トライアルを提供する
3. When ユーザーが購入を完了する, the SeatSignal shall Pro の全機能を即座に解放する
4. When ユーザーが「購入を復元」を実行する, the SeatSignal shall 過去の購入に基づき Pro 権利を復元する
5. When アプリを再起動する, the SeatSignal shall 保持している Pro 権利を自動的に復元する
6. If ユーザーが購入をキャンセルする, the SeatSignal shall エラー扱いにせず購入前の状態に戻す
7. If 商品情報の取得に失敗する, the SeatSignal shall エラー表示と再試行手段を提供する
8. When サブスクリプションが解約・期限切れになる, the SeatSignal shall Pro 機能へのアクセスを無料プラン相当に戻す
9. The SeatSignal shall Paywall からプライバシーポリシーと利用規約へ遷移できるようにする
10. The SeatSignal shall 自動更新の条件と解約方法を Paywall 上に明示する

### Requirement 14: 多言語・外観

**Priority:** Must（日英）
**Objective:** ユーザーとして、自分の言語と好みの外観で利用したい。それにより、快適に操作できる。

#### Acceptance Criteria

1. The SeatSignal shall 日本語と英語の表示を提供し、設定から切り替えられるようにする
2. The SeatSignal shall ダーク/ライトの外観切替を提供する
3. When 言語を切り替える, the SeatSignal shall 全画面の表示文言を選択言語へ即座に反映する

### Requirement 15: オフライン・低データ・エラー状態

**Priority:** Must
**Objective:** ユーザーとして、通信やデータの問題があっても状況を理解し次の行動を取りたい。それにより、アプリへの信頼を維持できる。

#### Acceptance Criteria

1. If 端末がオフラインである, the SeatSignal shall オフラインであることと再試行手段を表示する
2. Where 保存済みの時刻表データがある, the SeatSignal shall オフライン時にも保存済み時刻表の閲覧を提供する
3. If 対象区間の実測データが不足している, the SeatSignal shall 「予測データ不足」を明示し、時刻表のみの表示へ切り替える選択肢を提供する
4. If アプリがクラッシュする, the SeatSignal shall 運用者がクラッシュを検知できるよう記録する
5. If 通信エラーが発生する, the SeatSignal shall ユーザーが理解できるエラーメッセージと再試行手段を表示する

### Requirement 16: プライバシー・データ管理

**Priority:** Must
**Objective:** ユーザーとして、移動履歴や身体状況が保護されることを確認したい。それにより、安心してフィードバックを提供できる。

#### Acceptance Criteria

1. The SeatSignal shall 個人向けの快適性計算を可能な限り端末内で実行し、移動履歴を恒久的にサーバー保存しない
2. The SeatSignal shall 乗車中のみ有効な匿名 Trip ID を使用し、乗車終了後の定められた期間内に個人との関連付けを削除する
3. The SeatSignal shall 集約済み統計のみをコミュニティデータとして扱い、サンプル数が少ないデータを単独で表示しない
4. The SeatSignal shall 降車予定駅・身体情報を他のユーザーへ公開しない
5. When ユーザーが移動履歴の削除を実行する, the SeatSignal shall 該当データを削除し完了を表示する
6. The SeatSignal shall 設定画面から言語・通知・位置情報・データ共有・履歴削除・サブスクリプション管理・プライバシーポリシー・利用規約へアクセスできるようにする
7. The SeatSignal shall データ共有の範囲をユーザーが選択できるようにする

### Requirement 17: 利用状況の計測（運用者向け）

**Priority:** Must
**Objective:** 運用者として、価値仮説の検証に必要なファネルを測定したい。それにより、MVP の成功指標を判断できる。

#### Acceptance Criteria

1. The SeatSignal shall オンボーディング完了・検索開始/完了・ルート選択（種別ごと）・乗車開始・フィードバック送信・Paywall 表示・トライアル開始・購入完了/復元/失敗のイベントを記録する
2. The SeatSignal shall 各イベントに対象路線・時間帯・選択ルート種別・最速との差分時間・削減予想立ち時間・プラン種別・予測信頼度を付与する
3. The SeatSignal shall Paywall の表示契機（トリガー種別）ごとの表示数と転換を計測可能にする
4. The SeatSignal shall 「アプリ起動→検索→快適ルート閲覧→快適ルート選択→乗車完了→フィードバック→Paywall→購入」のファネルを測定可能にする
5. The SeatSignal shall 分析目的で送信するデータを必要最小限にし、正確な位置情報・自宅/勤務先を送信しない

### Requirement 18: ストア公開品質

**Priority:** Must
**Objective:** 運用者として、ハッカソン期間内にストア審査を通過し一般公開したい。それにより、実ユーザーが利用できる。

#### Acceptance Criteria

1. The SeatSignal shall アカウント削除またはデータ削除の導線をアプリ内に備える
2. The SeatSignal shall プライバシーポリシー・利用規約・サポート連絡先への導線を備える
3. The SeatSignal shall 利用する外部データ提供元の利用条件で求められる帰属（クレジット）表示をアプリ内に備える
4. The SeatSignal shall 日本語と英語のストア説明・スクリーンショットを準備した状態で提出可能にする
5. The SeatSignal shall 審査環境および本番ストア環境の双方で購入・復元・解約後の権利変更を確認可能にする
6. The SeatSignal shall 実機上で主要フロー（検索→比較→詳細→フィードバック→購入）を動作させられる
