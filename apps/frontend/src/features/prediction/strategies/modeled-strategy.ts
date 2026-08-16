import type { AppError, ComfortEstimate, ComfortSegment, Result } from "shared";
import { createAppError, err, isErr, ok } from "shared";

import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
  TimetableDatasetPayload,
} from "@/features/dataset/dataset-store";
import {
  predictLeg,
  recommendBoarding as recommendBoardingFromProfiles,
} from "@/features/prediction/prediction-engine";
import { floorToTimeBucket, minutesOfDay } from "@/lib/clock-time";
import { intermediateStationIds } from "@/lib/station-utils";
import type { CongestionStrategy, EstimateInput } from "./types";

type ModeledStrategyDeps = {
  timetable: TimetableDatasetPayload;
  congestion: CongestionDatasetPayload;
  correction: CorrectionDatasetPayload;
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * departureTime/arrivalTime は日付を持たない "HH:mm" のペアなので、単純な
 * 引き算では深夜またぎ（例: 23:50発→00:10着）が負の所要時間になる。
 * 差が負なら日をまたいだとみなし 24 時間分を足して復元する。差がちょうど
 * 0（同時刻）は復元しようがない不正入力として predictLeg に渡す前に弾く
 * -- buildSegments の minutesPerSegment が 0 や負になり、区間の所要時間が
 * 意味を失うのを防ぐ。
 */
function resolveTripMinutes(input: EstimateInput): Result<number, AppError> {
  const rawMinutes =
    minutesOfDay(input.arrivalTime) - minutesOfDay(input.departureTime);
  if (rawMinutes === 0) {
    return err(
      createAppError(
        "validation_error",
        "arrivalTime must differ from departureTime",
      ),
    );
  }
  return ok(rawMinutes < 0 ? rawMinutes + MINUTES_PER_DAY : rawMinutes);
}

/**
 * 合成デモデータセット用の戦略。データが実測ではないため provenance は
 * 常に "modeled" を返す。ここが本アプリで唯一 legKey/timeBucket/railwayId を
 * 組み立てる場所であり、呼び出し側にこれらは漏れない。
 */
export function createModeledStrategy(
  deps: ModeledStrategyDeps,
): CongestionStrategy {
  const { timetable, congestion, correction } = deps;

  function lookupKey(input: EstimateInput) {
    const railwayId =
      timetable.stations.find((station) => station.id === input.fromStationId)
        ?.railwayId ?? "";
    return {
      railwayId,
      legKey: `${input.fromStationId}-${input.toStationId}`,
      timeBucket: floorToTimeBucket(input.departureTime),
      dayType: input.dayType,
    };
  }

  /**
   * 乗車駅→降車駅を停車駅で刻む。合成データセットは区間全体でしか
   * キーされておらず駅間の所要時間を持たないため、所要時間は区間数で
   * 等分する（現行の PER_STATION_PROBABILITY_STEP による着座確率の
   * 単調増加が既に同じ仮定を置いている）。実所要時間は M2 の
   * GTFS 準拠スキーマ（stopTimes）で初めて利用可能になる。
   */
  function buildSegments(
    input: EstimateInput,
    tripMinutes: number,
    perStation: ReadonlyArray<{ stationId: string; probability: number }>,
    baseSeatProbability: number,
  ): ComfortSegment[] {
    const stopIds = [
      input.fromStationId,
      ...perStation.map((entry) => entry.stationId),
      input.toStationId,
    ];
    const segmentCount = stopIds.length - 1;
    const minutesPerSegment = tripMinutes / segmentCount;

    const segments: ComfortSegment[] = [];
    for (let i = 0; i < segmentCount; i++) {
      // 区間 i を走行中の着座確率は、その区間に入る直前の停車駅時点の値。
      // i === 0 は乗車駅なので基準値、それ以降は perStation[i - 1]。
      const seatProbability =
        i === 0 ? baseSeatProbability : perStation[i - 1].probability;
      segments.push({
        fromStopId: stopIds[i],
        toStopId: stopIds[i + 1],
        minutes: minutesPerSegment,
        seatProbability,
      });
    }
    return segments;
  }

  return {
    provenance: "modeled",

    estimate(input: EstimateInput): Result<ComfortEstimate, AppError> {
      const key = lookupKey(input);
      const tripMinutesResult = resolveTripMinutes(input);
      if (isErr(tripMinutesResult)) {
        return tripMinutesResult;
      }
      const tripMinutes = tripMinutesResult.data;

      const predicted = predictLeg(congestion, correction, {
        ...key,
        tripMinutes,
        intermediateStationIds: intermediateStationIds(
          timetable,
          input.fromStationId,
          input.toStationId,
        ),
        delayMinutes: input.delayMinutes,
      });
      if (isErr(predicted)) {
        return predicted;
      }

      // predictLeg と recommendBoardingFromProfiles は congestion.profiles を
      // 同一の4条件（railwayId/legKey/timeBucket/dayType）で filter するため、
      // 直前の predictLeg が成功した時点でこの呼び出しが insufficient_data に
      // なることはない。それでも Result 型として扱う（呼び出し不能をアサート
      // で握り潰さない）ため isErr 分岐は残るが、undefined になる実行経路は
      // ModeledStrategy には存在しない。
      const boarding = recommendBoardingFromProfiles(congestion, key);

      return ok({
        segments: buildSegments(
          input,
          tripMinutes,
          predicted.data.perStationSeatProbability,
          predicted.data.seatProbability,
        ),
        byCarriage: isErr(boarding)
          ? undefined
          : boarding.data.carComparisons.map((car) => ({
              carriageNumber: car.carNumber,
              seatProbability: car.seatProbability,
            })),
        provenance: "modeled",
        standingMinutes: predicted.data.standingMinutes,
        seatedMinutes: predicted.data.seatedMinutes,
        seatProbability: predicted.data.seatProbability,
        confidence: predicted.data.confidence,
        sampleSizeHint: predicted.data.sampleSizeHint,
        factors: predicted.data.factors,
        comfortScore: predicted.data.comfortScore,
      });
    },
  };
}
