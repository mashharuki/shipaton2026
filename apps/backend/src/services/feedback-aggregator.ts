import {
  type DayType,
  MIN_SAMPLE_SIZE_FOR_AGGREGATION,
  STANDING_MINUTES_SCALE,
  type VS_EXPECTED_OUTCOMES,
} from "shared";
import type { FeedbackRow } from "../db/queries";

type VsExpected = (typeof VS_EXPECTED_OUTCOMES)[number];

export type CorrectionCell = {
  railwayId: string;
  legKey: string;
  timeBucket: string;
  dayType: DayType;
  deltaScore: number;
  sampleN: number;
};

export type MaeResult = {
  maeStandingMin: number;
  railwayId: string;
  n: number;
};

/**
 * Feedback rows carry no numeric "actual standing minutes" (only the
 * categorical seatedOutcome + optional vsExpected) -- neither
 * requirements.md nor design.md define a formula for turning that into a
 * correction score. `vsExpected` is the purpose-built calibration signal
 * (Req 8.3/8.5: "予測との差...の任意回答"), so it's the sole input here;
 * rows without it contribute 0 (treated as "no reported deviation") rather
 * than being excluded, so silence doesn't shrink the sample count used for
 * the n>=5 threshold. The magnitude (0.1) is a conservative MVP constant:
 * at STANDING_MINUTES_SCALE=30 a unanimous cell swings the prediction by
 * +/-3 minutes, in line with the other per-factor contributions in
 * shared/src/prediction/scoring.ts.
 */
const VS_EXPECTED_DELTA: Record<VsExpected, number> = {
  less_crowded_than_expected: -0.1,
  as_expected: 0,
  more_crowded_than_expected: 0.1,
};

function observedDelta(row: FeedbackRow): number {
  return row.vsExpected === null ? 0 : VS_EXPECTED_DELTA[row.vsExpected];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cellKey(row: FeedbackRow): string {
  return `${row.railwayId}|${row.legKey}|${row.timeBucket}|${row.dayType}`;
}

/** Full recompute (task 3.4: "全量再計算") -- takes the complete row set, not a delta. */
export function aggregateCorrectionStats(
  rows: FeedbackRow[],
): CorrectionCell[] {
  const groups = new Map<string, FeedbackRow[]>();
  for (const row of rows) {
    const key = cellKey(row);
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const cells: CorrectionCell[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_SAMPLE_SIZE_FOR_AGGREGATION) {
      continue;
    }
    const first = group[0];
    if (!first) {
      continue;
    }
    cells.push({
      railwayId: first.railwayId,
      legKey: first.legKey,
      timeBucket: first.timeBucket,
      dayType: first.dayType,
      deltaScore: average(group.map(observedDelta)),
      sampleN: group.length,
    });
  }
  return cells;
}

/**
 * No numeric predicted-vs-actual minutes pair exists in feedback either, so
 * the same vsExpected-derived deviation signal doubles as the MAE input
 * (|deviation| * STANDING_MINUTES_SCALE) -- this reports "average magnitude
 * of reported crowding-perception deviation, in minutes", not a literal
 * measured standing-time error. Revisit once feedback captures an actual
 * duration. Returns null when there are no rows at all (nothing to report).
 *
 * `railwayId` is taken from an arbitrary row rather than tracked per
 * railway -- correct only because `metrics` has a single-railway MVP
 * scope (PK is `date` alone, see the 0001_init_schema.sql comment on that
 * table). Revisit alongside that table once a second railway is onboarded.
 */
export function computeMae(rows: FeedbackRow[]): MaeResult | null {
  const first = rows[0];
  if (!first) {
    return null;
  }
  const errors = rows.map(
    (row) => Math.abs(observedDelta(row)) * STANDING_MINUTES_SCALE,
  );
  return {
    maeStandingMin: average(errors),
    railwayId: first.railwayId,
    n: rows.length,
  };
}
