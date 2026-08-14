import type {
  AppError,
  ComfortEstimate,
  ComfortProvenance,
  DayType,
  Result,
} from "shared";

import type { BoardingAdvice } from "@/features/prediction/types";

/**
 * 混雑推定への入力。呼び出し側は駅・時刻・曜日だけを渡す。
 * legKey / timeBucket / railwayId といった検索キーの組み立ては
 * 戦略の実装内部の関心であり、ここには現れない。
 */
export type EstimateInput = {
  fromStationId: string;
  toStationId: string;
  departureTime: string;
  arrivalTime: string;
  dayType: DayType;
  delayMinutes?: number;
};

/**
 * 混雑推定の差し替え可能な契約。地域ごとにデータの形が根本的に違う
 * （号車別実測 / 現在時刻のみ / 駅統計 / データ無し）ため、共通化は
 * 入力側ではなく出力側（ComfortEstimate）で行う。
 */
export interface CongestionStrategy {
  readonly provenance: ComfortProvenance;
  estimate(input: EstimateInput): Result<ComfortEstimate, AppError>;
  recommendBoarding(input: EstimateInput): Result<BoardingAdvice, AppError>;
}
