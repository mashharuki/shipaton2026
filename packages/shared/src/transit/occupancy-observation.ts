/**
 * Region-agnostic real-time occupancy observation (design doc §5.1/§5.4,
 * docs/superpowers/specs/2026-08-13-transit-data-sourcing-design.md).
 *
 * This is the ② Estimation layer's *input* shape for any region that has
 * real measured/predicted occupancy data (M4: Sydney TfNSW). Almost every
 * field is optional by design, not by oversight -- which fields are present
 * reflects what a given region's data actually supplies (§5.4's table: a
 * carriage-level GTFS-RT extension supplies almost everything, a station-
 * level congestion-rate feed supplies none of the trip-scoped fields). A
 * `CongestionStrategy` implementation degrades based on what's actually
 * present rather than assuming a fixed shape.
 */

/**
 * GTFS-RT's standard 6-level ordinal occupancy enum
 * (https://gtfs.org/documentation/realtime/reference/#enum-occupancystatus).
 * Ordinal, not a percentage -- most real feeds (including TfNSW's) report
 * this rather than a continuous value, which is why `seatProbabilityForOccupancyStatus`
 * maps from this rather than treating occupancy as already continuous (P5,
 * design doc §2.1: treating an ordinal scale as continuous is fabricating
 * precision the source data doesn't have).
 */
export const OCCUPANCY_STATUSES = [
  "EMPTY",
  "MANY_SEATS_AVAILABLE",
  "FEW_SEATS_AVAILABLE",
  "STANDING_ROOM_ONLY",
  "CRUSHED_STANDING_ROOM_ONLY",
  "FULL",
] as const;
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];

export function isOccupancyStatus(value: unknown): value is OccupancyStatus {
  return (
    typeof value === "string" &&
    (OCCUPANCY_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * A single real-time occupancy reading for one stop of one trip (optionally
 * one carriage within it). `horizon` distinguishes an operator's own
 * forward-looking prediction (TfNSW's `carriage_seq_predictive_occupancy`)
 * from a same-instant measurement -- both are "measured" in the sense of
 * coming from operator instrumentation rather than this app's model, but
 * only "actual" is a direct sensor reading.
 */
export type OccupancyObservation = {
  regionId: string;
  observedAt: string;
  tripId?: string;
  routeId?: string;
  stopId: string;
  stopSequence?: number;
  direction?: 0 | 1;
  carriageNumber?: number;
  occupancyStatus?: OccupancyStatus;
  occupancyPercentage?: number;
  horizon: "actual" | "predicted";
  source: string;
};

/**
 * Ordinal occupancy -> seatProbability, for the ESM formula in design doc
 * §5.5: `ESM = Σ(segment.minutes × (1 − segment.seatProbability))`.
 *
 * Calibration point (design doc §5.5, citing 서울교통공사's public data):
 * Seoul's official congestion-rate definition states a train is at 100%
 * ("all seats occupied, no standing") at a 34% crowding-rate reading on
 * their scale -- i.e. "every seat full, nobody standing yet" is a real,
 * externally-sourced anchor, not a value picked by this codebase. FULL
 * here means "crush-loaded" (GTFS-RT's top ordinal), which is a distinct,
 * more crowded state than that anchor point -- FULL's probability is set
 * below the anchor's implied ~0 standing-probability accordingly. The
 * intermediate steps are an even split, not independently calibrated;
 * revisit once M5's accuracy-verification pipeline (§7) has real MAE data
 * to calibrate against.
 */
const SEAT_PROBABILITY_BY_OCCUPANCY_STATUS: Record<OccupancyStatus, number> = {
  EMPTY: 1,
  MANY_SEATS_AVAILABLE: 1,
  FEW_SEATS_AVAILABLE: 0.6,
  STANDING_ROOM_ONLY: 0.2,
  CRUSHED_STANDING_ROOM_ONLY: 0.05,
  FULL: 0,
};

export function seatProbabilityForOccupancyStatus(
  status: OccupancyStatus,
): number {
  return SEAT_PROBABILITY_BY_OCCUPANCY_STATUS[status];
}
