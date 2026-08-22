/**
 * M4 (docs/superpowers/specs/2026-08-13-transit-data-sourcing-design.md §8):
 * "シドニー TfNSW アダプタ＋MeasuredStrategy。完了条件: 号車別実測が UI に出る"
 *
 * Fetches and decodes a TfNSW (Transport for NSW) GTFS-RT feed into
 * `OccupancyObservation[]` for `MeasuredStrategy`
 * (apps/frontend/src/features/prediction/strategies/measured-strategy.ts).
 *
 * ## What this uses, and why the originally-planned "extension 1007" approach was dropped
 *
 * The design doc (§3.3) describes Sydney's per-carriage predictive occupancy
 * as TfNSW's proprietary GTFS-RT extension 1007 (`CarriageDescriptor`,
 * `carriage_seq_predictive_occupancy`), whose exact wire format (field
 * numbers, message nesting) is not independently verifiable from this
 * sandbox (no outbound network -- same constraint as M3's Transitland work).
 * Guessing those field numbers would risk silently decoding garbage that
 * *looks* like valid data, which is worse than not implementing it.
 *
 * Installing `gtfs-realtime-bindings@2.2.0` and reading its compiled
 * `.d.ts` (a verifiable, type-checked source of truth, unlike guessing from
 * memory) showed the **base GTFS-RT spec has since absorbed per-carriage
 * occupancy as standard fields**: `VehiclePosition.multiCarriageDetails[]`
 * (id/occupancyStatus/occupancyPercentage/carriageSequence) and
 * `TripUpdate.StopTimeUpdate.departureOccupancyStatus`. Neither alone gives
 * "per future stop AND per carriage" the way the extension reportedly does,
 * but combined they give two real, standard-spec, type-verified signals:
 *
 * 1. `StopTimeUpdate.departureOccupancyStatus` -- per future stop across
 *    the whole trip, vehicle-level (no carriage breakdown). `horizon: "predicted"`.
 * 2. `VehiclePosition.multiCarriageDetails[]` -- per carriage, but only a
 *    snapshot at the vehicle's current stop. `horizon: "actual"`.
 *
 * This is a genuine, verified subset of what M4 needs -- not a full
 * realization of the design doc's original description of extension 1007.
 * If TfNSW's actual feed turns out to still require that proprietary
 * extension for carriage-level data (rather than the now-standardized
 * `multiCarriageDetails`), this client will simply observe empty
 * `multiCarriageDetails` arrays and MeasuredStrategy will correctly degrade
 * `byCarriage` to `undefined` (design principle 5) -- it fails safe, not
 * silently wrong.
 *
 * ## Known limitation: protobuf3 field presence (empirically confirmed, not just theorized)
 *
 * `departureOccupancyStatus` and `CarriageDetails.occupancyStatus` are
 * plain (non-`optional`) enum fields in this package's compiled schema.
 * `test/scripts/ingest/tfnsw-client.test.ts`'s "documents a known
 * limitation" case proves (by round-tripping a real encoded FeedMessage
 * through the real decoder, not by reading the .d.ts) that a
 * `StopTimeUpdate` with no `departureOccupancyStatus` set at all decodes to
 * `EMPTY` (its proto3 zero value) -- indistinguishable from a stop the feed
 * genuinely reported as empty. This client cannot fix that; it's the wire
 * format's own ambiguity, not a bug in the decode logic here. In practice
 * this means: if TfNSW's real feed doesn't populate this field for every
 * `StopTimeUpdate` (many operators only populate it for some), this
 * client's `EMPTY` observations will be systematically over-reported.
 * A feed that wants to explicitly say "unknown" has the
 * `NO_DATA_AVAILABLE` sentinel available for exactly this reason -- this
 * client already excludes that value from `OCCUPANCY_STATUS_BY_ORDINAL`, so
 * a well-behaved feed's explicit "unknown" is correctly skipped. Only a
 * feed that silently omits the field (rather than explicitly marking it
 * unknown) triggers this limitation. Cross-check against a real response
 * before trusting `EMPTY` readings from this client in production.
 *
 * This is ingestion tooling (apps/backend/scripts/), not a deployed Workers
 * dependency -- see apps/backend/CLAUDE.md.
 */
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import {
  type AppError,
  createAppError,
  err,
  type OccupancyObservation,
  type OccupancyStatus,
  ok,
  type Result,
} from "shared";

const { transit_realtime } = GtfsRealtimeBindings;

export type TfnswFetchOptions = {
  feedUrl: string;
  apiKey: string;
  regionId: string;
};

/**
 * Reverse-lookup from the package's numeric OccupancyStatus enum to this
 * app's OccupancyStatus string union. `NOT_ACCEPTING_PASSENGERS`(6)/
 * `NO_DATA_AVAILABLE`(7)/`NOT_BOARDABLE`(8) are deliberately excluded --
 * they're operational states added in a later GTFS-RT spec revision, not a
 * position on the "how full is it" ordinal scale this app's OccupancyStatus
 * models. An entity reporting one of those (or an unrecognized value) is
 * skipped rather than mapped to a nearby ordinal.
 */
const OCCUPANCY_STATUS_BY_ORDINAL: Partial<Record<number, OccupancyStatus>> = {
  [transit_realtime.VehiclePosition.OccupancyStatus.EMPTY]: "EMPTY",
  [transit_realtime.VehiclePosition.OccupancyStatus.MANY_SEATS_AVAILABLE]:
    "MANY_SEATS_AVAILABLE",
  [transit_realtime.VehiclePosition.OccupancyStatus.FEW_SEATS_AVAILABLE]:
    "FEW_SEATS_AVAILABLE",
  [transit_realtime.VehiclePosition.OccupancyStatus.STANDING_ROOM_ONLY]:
    "STANDING_ROOM_ONLY",
  [transit_realtime.VehiclePosition.OccupancyStatus.CRUSHED_STANDING_ROOM_ONLY]:
    "CRUSHED_STANDING_ROOM_ONLY",
  [transit_realtime.VehiclePosition.OccupancyStatus.FULL]: "FULL",
};

function toOccupancyStatus(
  ordinal: number | null | undefined,
): OccupancyStatus | undefined {
  if (ordinal === null || ordinal === undefined) {
    return undefined;
  }
  return OCCUPANCY_STATUS_BY_ORDINAL[ordinal];
}

export async function fetchOccupancyObservations(
  options: TfnswFetchOptions,
): Promise<Result<OccupancyObservation[], AppError>> {
  let response: Response;
  try {
    response = await fetch(options.feedUrl, {
      headers: { Authorization: `apikey ${options.apiKey}` },
    });
  } catch (cause) {
    return err(
      createAppError("offline", "TfNSW GTFS-RT request failed", cause),
    );
  }
  if (!response.ok) {
    return err(
      createAppError(
        "http_error",
        `TfNSW GTFS-RT responded ${response.status}`,
      ),
    );
  }

  let feed: InstanceType<typeof transit_realtime.FeedMessage>;
  try {
    const buffer = new Uint8Array(await response.arrayBuffer());
    feed = transit_realtime.FeedMessage.decode(buffer);
  } catch (cause) {
    return err(
      createAppError(
        "validation_error",
        "Failed to decode GTFS-RT FeedMessage",
        cause,
      ),
    );
  }

  const observedAt = new Date(
    Number(feed.header.timestamp) * 1000,
  ).toISOString();
  const observations: OccupancyObservation[] = [];

  for (const entity of feed.entity ?? []) {
    if (entity.tripUpdate) {
      const tripId = entity.tripUpdate.trip?.tripId || undefined;
      const routeId = entity.tripUpdate.trip?.routeId || undefined;
      for (const stopTimeUpdate of entity.tripUpdate.stopTimeUpdate ?? []) {
        if (!stopTimeUpdate.stopId) {
          continue;
        }
        const occupancyStatus = toOccupancyStatus(
          stopTimeUpdate.departureOccupancyStatus,
        );
        if (!occupancyStatus) {
          continue;
        }
        observations.push({
          regionId: options.regionId,
          observedAt,
          tripId,
          routeId,
          stopId: stopTimeUpdate.stopId,
          stopSequence: stopTimeUpdate.stopSequence ?? undefined,
          occupancyStatus,
          horizon: "predicted",
          source: "tfnsw-gtfs-rt-trip-update",
        });
      }
    }

    if (entity.vehicle?.stopId) {
      const tripId = entity.vehicle.trip?.tripId || undefined;
      const routeId = entity.vehicle.trip?.routeId || undefined;
      for (const carriage of entity.vehicle.multiCarriageDetails ?? []) {
        const occupancyStatus = toOccupancyStatus(carriage.occupancyStatus);
        if (!occupancyStatus) {
          continue;
        }
        observations.push({
          regionId: options.regionId,
          observedAt,
          tripId,
          routeId,
          stopId: entity.vehicle.stopId,
          stopSequence: entity.vehicle.currentStopSequence ?? undefined,
          carriageNumber: carriage.carriageSequence ?? undefined,
          occupancyStatus,
          horizon: "actual",
          source: "tfnsw-gtfs-rt-vehicle-position",
        });
      }
    }
  }

  return ok(observations);
}
