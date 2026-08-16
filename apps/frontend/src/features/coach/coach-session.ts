import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import type { RouteLeg } from "@/features/search/route-search-engine";

export type CoachStop = {
  stationId: string;
  arrivalTime: string;
  departureTime: string;
  legIndex: number;
};

export type CoachProgress = {
  currentStationId: string;
  currentLegIndex: number;
  nextStationId: string | null;
  remainingStops: number;
  isApproachingDestination: boolean;
};

// 7.1/7.4: resolves each leg into its real stop-by-stop timetable (a trip's
// own stopTimes already carries a per-station arrival/departure time,
// ordered by that trip's own stopSequence, not just the leg's own
// boarding/alighting times) into one ordered, ride-wide stop sequence tagged
// with which leg each stop belongs to. A transfer's boarding stop
// intentionally duplicates the previous leg's alighting station id (same
// stationId, two different scheduled times, two different legIndex values)
// rather than being deduped -- deriveCoachProgress below relies on that
// duplication to represent "waiting at the transfer station" as a real,
// elapsed-time-driven state instead of a special case.
export function buildStopSequence(
  timetable: TimetableDatasetPayload,
  legs: readonly RouteLeg[],
): CoachStop[] {
  const stops: CoachStop[] = [];
  for (const [legIndex, leg] of legs.entries()) {
    const trip = timetable.trips.find((t) => t.tripId === leg.trainId);
    if (!trip) {
      return [];
    }

    const orderedStopTimes = [...trip.stopTimes].sort(
      (a, b) => a.stopSequence - b.stopSequence,
    );
    const fromIdx = orderedStopTimes.findIndex(
      (stopTime) => stopTime.stopId === leg.fromStationId,
    );
    const toIdx = orderedStopTimes.findIndex(
      (stopTime) => stopTime.stopId === leg.toStationId,
    );
    if (fromIdx === -1 || toIdx === -1) {
      return [];
    }
    const [lower, upper] =
      fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];

    for (const stopTime of orderedStopTimes.slice(lower, upper + 1)) {
      stops.push({
        stationId: stopTime.stopId,
        arrivalTime: stopTime.arrivalTime,
        departureTime: stopTime.departureTime,
        legIndex,
      });
    }
  }
  return stops;
}

// 7.1/7.4/7.5: derives the rider's progress along `stops` from elapsed
// wall-clock time alone -- no device geolocation dependency in this pass.
// This is a scope decision made in this task, not something design.md
// mandates outright: design.md's own File Structure Plan labels
// coach-session.ts a state machine "位置あり/なし推定" (WITH/without location
// estimation), and task 7.1's completion condition ("位置情報オフでも...")
// presupposes a location-available path exists to be toggled off. What's
// implemented here is only the location-absent branch, matching the ONE
// state machine design.md's Unit Tests list (item 4) actually names as the
// tested surface, and consistent with the pre-mortem review's suggestion
// (docs/pm/review-seatsignal-idea-2026-08-04.md line 56, itself an
// unincorporated "reflect in requirements.md" suggestion, not an approved
// design.md decision) to keep Coach honest as "timetable-based station
// progression" for this MVP. Adding a real geolocation-available path is
// out of this pass's scope and needs explicit follow-up sign-off, not a
// silent assumption that it was never wanted.
export function deriveCoachProgress(
  stops: readonly CoachStop[],
  now: string,
): CoachProgress {
  if (stops.length === 0) {
    throw new Error("deriveCoachProgress requires a non-empty stop sequence");
  }

  // Last stop whose scheduled departure has already passed -- if none has
  // (now < stops[0].departureTime), the rider is still at the boarding
  // station, which is exactly index 0's initial value.
  let idx = 0;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (stop && stop.departureTime <= now) {
      idx = i;
    }
  }

  const current = stops[idx];
  if (!current) {
    throw new Error("deriveCoachProgress requires a non-empty stop sequence");
  }

  // A transfer's boarding stop duplicates the previous leg's alighting
  // station id (same stationId, later departureTime, see buildStopSequence's
  // own note) so the dwell time between them is a real elapsed-time state.
  // "Next" and "remaining" must skip past any of those same-station
  // duplicates, or a rider waiting at a transfer station would see it
  // reported as both their current AND next station.
  let nextIdx = idx + 1;
  while (
    nextIdx < stops.length &&
    stops[nextIdx]?.stationId === current.stationId
  ) {
    nextIdx++;
  }
  const next = nextIdx < stops.length ? stops[nextIdx] : undefined;

  let remainingStops = 0;
  let lastStationId = current.stationId;
  for (let i = idx + 1; i < stops.length; i++) {
    const stop = stops[i];
    if (stop && stop.stationId !== lastStationId) {
      remainingStops++;
      lastStationId = stop.stationId;
    }
  }

  return {
    currentStationId: current.stationId,
    currentLegIndex: current.legIndex,
    nextStationId: next ? next.stationId : null,
    remainingStops,
    // 7.5: fires strictly before the destination is reached (next stop IS
    // the final stop), not once the rider is already there.
    isApproachingDestination: remainingStops === 1,
  };
}

export type TrainStatusSnapshot = {
  delayMinutes: number;
  stale?: boolean;
};

// 7.2/7.4: decides which delay value Coach's next prediction recompute
// should use. Keeps the previous value when a poll attempt produced nothing
// at all (`incoming === null` -- network/5xx failure) rather than resetting
// to "no delay", and accepts a `stale: true` snapshot as valid input rather
// than treating staleness as failure ("運行情報が stale の場合も案内を継続する").
export function resolveDelayMinutes(
  previous: number,
  incoming: TrainStatusSnapshot | null,
): number {
  return incoming ? incoming.delayMinutes : previous;
}
