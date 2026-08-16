import type { ComfortEstimate } from "shared";

import type { BoardingAdvice, CarComparison } from "./types";

const BOARDING_REASON_MESSAGE_KEY = "routeDetail.reason.lowestCongestion";

/**
 * ComfortEstimate.byCarriage から BoardingAdvice を導出する。どの号車を
 * 推薦するか（座席確率が最も高い号車を選ぶ）は byCarriage さえ埋まって
 * いれば地域を問わず同じロジックなので、各戦略が個別に実装する必要はない
 * -- CongestionStrategy に recommendBoarding を持たせず、estimate() が
 * 一度だけ計算した byCarriage をここで再利用する。
 *
 * byCarriage が undefined の ComfortEstimate（号車別データを持たない
 * 地域）では undefined を返す -- byCarriage が optional であることの
 * 帰結で、呼び出し側はこの型で degrade を判定する。
 */
export function deriveBoardingAdvice(
  estimate: ComfortEstimate,
): BoardingAdvice | undefined {
  const byCarriage = estimate.byCarriage;
  if (!byCarriage || byCarriage.length === 0) {
    return undefined;
  }

  const carComparisons: CarComparison[] = byCarriage.map((car) => ({
    carNumber: car.carriageNumber,
    loadScore: 1 - car.seatProbability,
    seatProbability: car.seatProbability,
  }));

  const recommended = carComparisons.reduce((best, car) =>
    car.seatProbability > best.seatProbability ? car : best,
  );
  const carCount = Math.max(...carComparisons.map((car) => car.carNumber));

  return {
    recommendedCarNumber: recommended.carNumber,
    carCount,
    carComparisons,
    confidence: estimate.confidence,
    reasonMessageKey: BOARDING_REASON_MESSAGE_KEY,
  };
}
