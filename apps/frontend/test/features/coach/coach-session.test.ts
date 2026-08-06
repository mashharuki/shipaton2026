import { describe, expect, it } from "vitest";

import {
  buildStopSequence,
  deriveCoachProgress,
  resolveDelayMinutes,
} from "@/features/coach/coach-session";
import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import type { RouteLeg } from "@/features/search/route-search-engine";
import timetableFixture from "../../../../backend/fixtures/datasets/timetable.json";

const timetable = timetableFixture.payload as TimetableDatasetPayload;

const directLeg: RouteLeg = {
  trainId: "TRAIN_WEEKDAY_0700",
  fromStationId: "STA_SHINJUKU",
  toStationId: "STA_TOKYO",
  departureTime: "07:00",
  arrivalTime: "07:16",
};

describe("buildStopSequence", () => {
  it("should resolve every real timetable stop between boarding and alighting for a direct leg", () => {
    const stops = buildStopSequence(timetable, [directLeg]);

    expect(stops.map((stop) => stop.stationId)).toEqual([
      "STA_SHINJUKU",
      "STA_YOTSUYA",
      "STA_OCHANOMIZU",
      "STA_KANDA",
      "STA_TOKYO",
    ]);
    expect(stops.every((stop) => stop.legIndex === 0)).toBe(true);
    expect(stops[0]?.departureTime).toBe("07:00");
    expect(stops.at(-1)?.arrivalTime).toBe("07:16");
  });

  it("should tag stops from a later leg with their own legIndex", () => {
    const transferLegs: RouteLeg[] = [
      {
        trainId: "TRAIN_WEEKDAY_0700",
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_YOTSUYA",
        departureTime: "07:00",
        arrivalTime: "07:05",
      },
      {
        trainId: "TRAIN_WEEKDAY_0715",
        fromStationId: "STA_YOTSUYA",
        toStationId: "STA_TOKYO",
        departureTime: "07:21",
        arrivalTime: "07:31",
      },
    ];

    const stops = buildStopSequence(timetable, transferLegs);

    const legIndexByStation = new Map(
      stops.map((stop) => [
        `${stop.stationId}:${stop.departureTime}`,
        stop.legIndex,
      ]),
    );
    expect(legIndexByStation.get("STA_SHINJUKU:07:00")).toBe(0);
    expect(legIndexByStation.get("STA_YOTSUYA:07:06")).toBe(0);
    expect(legIndexByStation.get("STA_YOTSUYA:07:21")).toBe(1);
    expect(legIndexByStation.get("STA_TOKYO:07:31")).toBe(1);
  });

  it("should return an empty sequence when a leg references an unknown station", () => {
    const stops = buildStopSequence(timetable, [
      { ...directLeg, fromStationId: "STA_NONEXISTENT" },
    ]);
    expect(stops).toEqual([]);
  });
});

describe("deriveCoachProgress", () => {
  const stops = buildStopSequence(timetable, [directLeg]);

  it("should place the rider at the boarding station before departure (7.4: timetable+elapsed-time estimation)", () => {
    const progress = deriveCoachProgress(stops, "06:55");
    expect(progress.currentStationId).toBe("STA_SHINJUKU");
    expect(progress.nextStationId).toBe("STA_YOTSUYA");
    expect(progress.remainingStops).toBe(4);
    expect(progress.isApproachingDestination).toBe(false);
  });

  it("should advance the rider's current station as elapsed time passes each departure", () => {
    const progress = deriveCoachProgress(stops, "07:12");
    expect(progress.currentStationId).toBe("STA_OCHANOMIZU");
    expect(progress.nextStationId).toBe("STA_KANDA");
    expect(progress.remainingStops).toBe(2);
  });

  it("should fire the alighting-guidance signal only when the next stop is the final destination (7.5)", () => {
    const progress = deriveCoachProgress(stops, "07:15");
    expect(progress.currentStationId).toBe("STA_KANDA");
    expect(progress.nextStationId).toBe("STA_TOKYO");
    expect(progress.remainingStops).toBe(1);
    expect(progress.isApproachingDestination).toBe(true);
  });

  it("should not flag approaching-destination once the destination itself is reached", () => {
    const progress = deriveCoachProgress(stops, "07:16");
    expect(progress.currentStationId).toBe("STA_TOKYO");
    expect(progress.nextStationId).toBeNull();
    expect(progress.remainingStops).toBe(0);
    expect(progress.isApproachingDestination).toBe(false);
  });

  it("should throw for an empty stop sequence", () => {
    expect(() => deriveCoachProgress([], "07:00")).toThrow();
  });

  it("should never report the same station as both current and next during a transfer wait", () => {
    // STA_YOTSUYA appears twice: once as leg 0's alighting stop (departs
    // 07:06, the arriving train continuing onward) and once as leg 1's
    // boarding stop (departs 07:21, a different train). At 07:10 the rider
    // is waiting at Yotsuya for the transfer -- "next" must be the next
    // DIFFERENT station, not another timestamp of the same station.
    const transferLegs: RouteLeg[] = [
      {
        trainId: "TRAIN_WEEKDAY_0700",
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_YOTSUYA",
        departureTime: "07:00",
        arrivalTime: "07:05",
      },
      {
        trainId: "TRAIN_WEEKDAY_0715",
        fromStationId: "STA_YOTSUYA",
        toStationId: "STA_TOKYO",
        departureTime: "07:21",
        arrivalTime: "07:31",
      },
    ];
    const transferStops = buildStopSequence(timetable, transferLegs);

    const progress = deriveCoachProgress(transferStops, "07:10");
    expect(progress.currentStationId).toBe("STA_YOTSUYA");
    expect(progress.nextStationId).not.toBe(progress.currentStationId);
    expect(progress.nextStationId).toBe("STA_OCHANOMIZU");
  });
});

describe("resolveDelayMinutes", () => {
  it("should keep the previous value when a poll attempt failed outright (7.4: stays continuing)", () => {
    expect(resolveDelayMinutes(5, null)).toBe(5);
  });

  it("should apply a stale snapshot's delay rather than treating staleness as failure (7.4)", () => {
    expect(resolveDelayMinutes(0, { delayMinutes: 8, stale: true })).toBe(8);
  });

  it("should apply a fresh snapshot's delay, triggering a recompute", () => {
    expect(resolveDelayMinutes(0, { delayMinutes: 3, stale: false })).toBe(3);
  });
});
