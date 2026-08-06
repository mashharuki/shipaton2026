import {
  type DayType,
  type PredictionFactorKind,
  type ScorePredictionResult,
  STANDING_MINUTES_SCALE,
  scorePrediction,
} from "shared";

export type CongestionProfileEntry = {
  legKey: string;
  timeBucket: string;
  dayType: DayType;
  carNumber: number;
  loadScore: number;
  sampleSize: number;
};

export type CorrectionCell = {
  legKey: string;
  timeBucket: string;
  dayType: DayType;
  deltaScore: number;
  sampleN: number;
};

export type AlternativeCandidate = {
  timeBucket: string;
  standingMinutesSaved: number;
};

export type NotificationPrediction = {
  shouldNotify: boolean;
  prediction: ScorePredictionResult;
  reasonFactor: PredictionFactorKind | null;
  alternative: AlternativeCandidate | null;
};

export type NotificationPredictionInput = {
  legKey: string;
  dayType: DayType;
  timeBucket: string;
  congestionProfiles: CongestionProfileEntry[];
  correctionCells: CorrectionCell[];
};

function averageLoadScore(entries: CongestionProfileEntry[]): number | null {
  if (entries.length === 0) {
    return null;
  }
  const sum = entries.reduce((total, entry) => total + entry.loadScore, 0);
  return sum / entries.length;
}

function totalSampleSize(entries: CongestionProfileEntry[]): number {
  return entries.reduce((total, entry) => total + entry.sampleSize, 0);
}

/**
 * "Increased crowding" (10.2/10.3) can only be detected relative to a
 * baseline, and the only baseline this batch has is the feedback-derived
 * correction (task 3.4's correction_stats: positive deltaScore = riders
 * report more crowding than the base profile predicted). There is no
 * weather/event dataset anywhere in this codebase yet, so that half of
 * 10.3's "雨・イベント等" reason text cannot be produced from real data --
 * the trigger and reason below are grounded in the correction signal only.
 */
function findAlternative(
  input: NotificationPredictionInput,
  currentLoadScore: number,
): AlternativeCandidate | null {
  const byBucket = new Map<string, CongestionProfileEntry[]>();
  for (const entry of input.congestionProfiles) {
    if (entry.legKey !== input.legKey || entry.dayType !== input.dayType) {
      continue;
    }
    const existing = byBucket.get(entry.timeBucket);
    if (existing) {
      existing.push(entry);
    } else {
      byBucket.set(entry.timeBucket, [entry]);
    }
  }

  let best: AlternativeCandidate | null = null;
  for (const [timeBucket, entries] of byBucket) {
    if (timeBucket === input.timeBucket) {
      continue;
    }
    const avg = averageLoadScore(entries);
    if (avg === null) {
      continue;
    }
    const saved =
      Math.round((currentLoadScore - avg) * STANDING_MINUTES_SCALE * 10) / 10;
    if (saved > 0 && (best === null || saved > best.standingMinutesSaved)) {
      best = { timeBucket, standingMinutesSaved: saved };
    }
  }
  return best;
}

export function buildNotificationPrediction(
  input: NotificationPredictionInput,
): NotificationPrediction {
  const currentEntries = input.congestionProfiles.filter(
    (entry) =>
      entry.legKey === input.legKey &&
      entry.dayType === input.dayType &&
      entry.timeBucket === input.timeBucket,
  );
  const baseLoadScore = averageLoadScore(currentEntries) ?? 0;
  const sampleSize = totalSampleSize(currentEntries);

  const correctionCell =
    input.correctionCells.find(
      (cell) =>
        cell.legKey === input.legKey &&
        cell.dayType === input.dayType &&
        cell.timeBucket === input.timeBucket,
    ) ?? null;

  const prediction = scorePrediction({
    baseLoadScore,
    sampleSize,
    feedbackCorrection: correctionCell
      ? { deltaScore: correctionCell.deltaScore }
      : undefined,
  });

  const shouldNotify = correctionCell !== null && correctionCell.deltaScore > 0;

  return {
    shouldNotify,
    prediction,
    reasonFactor: shouldNotify ? "feedback_correction" : null,
    alternative: shouldNotify ? findAlternative(input, baseLoadScore) : null,
  };
}
