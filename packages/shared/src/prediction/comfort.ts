import type {
  PredictionConfidence,
  PredictionFactor,
  StandingMinutesEstimate,
} from "./scoring";

/**
 * 混雑推定値の出所。UI の信頼度表示とストア審査時の説明責任がこれに乗る。
 * - measured:            事業者が実測した占有率（例: 車両重量センサ）
 * - operator_predicted:  事業者自身が予測した占有率（例: 事業者側の ML 出力）
 * - modeled:             本アプリが統計から導出した推定値。実測ではない
 * - user_feedback:       利用者の自己申告フィードバックのみに基づく
 */
export const COMFORT_PROVENANCES = [
  "measured",
  "operator_predicted",
  "modeled",
  "user_feedback",
] as const;

export type ComfortProvenance = (typeof COMFORT_PROVENANCES)[number];

export function isComfortProvenance(
  value: unknown,
): value is ComfortProvenance {
  return (
    typeof value === "string" &&
    (COMFORT_PROVENANCES as readonly string[]).includes(value)
  );
}

/**
 * 乗車駅から降車駅までを停車駅で刻んだ 1 区間。
 * 駅 ID で識別する（順序番号ではない）— UI は駅名を引く必要があり、
 * かつ駅 ID は現行スキーマにも GTFS 準拠スキーマにも存在するため、
 * 時刻表スキーマを差し替えてもこの契約は変わらない。
 */
export type ComfortSegment = {
  fromStopId: string;
  toStopId: string;
  minutes: number;
  /** この区間を通じて座れている確率 0–1 */
  seatProbability: number;
};

export type CarriageComfort = {
  carriageNumber: number;
  seatProbability: number;
};

/**
 * 混雑推定モジュールの唯一の出力契約。
 *
 * `byCarriage` が optional なのは設計上の妥協ではなく、地域ごとのデータ能力の
 * 差をそのまま型にした結果である。号車別データを持たない地域では欠落し、
 * UI は号車案内を出さない。degrade が型で表現される。
 *
 * `standingMinutes` 以下は現行 predictLeg 由来のフィールドで、
 * scorePrediction() の算出結果をそのまま運ぶ。M1 時点では segments は
 * 付加情報であり、standingMinutes を導出しない（振る舞いを変えないため）。
 */
export type ComfortEstimate = {
  segments: ReadonlyArray<ComfortSegment>;
  byCarriage?: ReadonlyArray<CarriageComfort>;
  provenance: ComfortProvenance;
  standingMinutes: StandingMinutesEstimate;
  seatedMinutes: number;
  seatProbability: number;
  confidence: PredictionConfidence;
  sampleSizeHint: string;
  factors: ReadonlyArray<PredictionFactor>;
  comfortScore: number;
};
