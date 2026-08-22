import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { isErr, isOk } from "shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOccupancyObservations } from "../../../scripts/ingest/tfnsw-client";

const { transit_realtime } = GtfsRealtimeBindings;
const { OccupancyStatus } = transit_realtime.VehiclePosition;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Encodes a real FeedMessage in-memory -- a round-trip fixture, not a live TfNSW response. */
function buildFeed(): Uint8Array {
  const message = transit_realtime.FeedMessage.create({
    header: {
      gtfsRealtimeVersion: "2.0",
      timestamp: 1_700_000_000,
    },
    entity: [
      {
        id: "trip-1",
        tripUpdate: {
          trip: { tripId: "SYD_T1", routeId: "SYD_R1" },
          stopTimeUpdate: [
            {
              stopId: "S1",
              stopSequence: 0,
              departureOccupancyStatus: OccupancyStatus.MANY_SEATS_AVAILABLE,
            },
            {
              stopId: "S2",
              stopSequence: 1,
              departureOccupancyStatus: OccupancyStatus.STANDING_ROOM_ONLY,
            },
            {
              // No departureOccupancyStatus set at all -- proto3 decodes
              // this the same as an explicit EMPTY. See the "documents a
              // known limitation" test below.
              stopId: "S3",
              stopSequence: 2,
            },
            {
              // Explicitly marked unknown by a well-behaved feed -- this
              // one SHOULD be skipped, unlike S3.
              stopId: "S4",
              stopSequence: 3,
              departureOccupancyStatus: OccupancyStatus.NO_DATA_AVAILABLE,
            },
          ],
        },
      },
      {
        id: "vehicle-1",
        vehicle: {
          trip: { tripId: "SYD_T1", routeId: "SYD_R1" },
          stopId: "S1",
          currentStopSequence: 0,
          multiCarriageDetails: [
            { carriageSequence: 1, occupancyStatus: OccupancyStatus.EMPTY },
            {
              carriageSequence: 2,
              occupancyStatus: OccupancyStatus.FEW_SEATS_AVAILABLE,
            },
          ],
        },
      },
      {
        // No tripUpdate/vehicle at all (e.g. an alert-only entity) -- must
        // not throw.
        id: "alert-1",
      },
    ],
  });
  return transit_realtime.FeedMessage.encode(message).finish();
}

describe("fetchOccupancyObservations", () => {
  it("decodes per-stop occupancy from trip updates and per-carriage occupancy from vehicle positions", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(buildFeed()),
    );

    const result = await fetchOccupancyObservations({
      feedUrl: "https://example.test/gtfsrt/tripupdates",
      apiKey: "test-key",
      regionId: "au-nsw-sydney",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const tripUpdateObservations = result.data.filter(
      (o) => o.source === "tfnsw-gtfs-rt-trip-update",
    );
    // S3 (unset field -> decodes as EMPTY, see "documents a known
    // limitation" below) is included; S4 (explicit NO_DATA_AVAILABLE) is
    // correctly excluded.
    expect(tripUpdateObservations).toHaveLength(3);
    expect(tripUpdateObservations.some((o) => o.stopId === "S4")).toBe(false);
    expect(tripUpdateObservations[0]).toMatchObject({
      stopId: "S1",
      stopSequence: 0,
      occupancyStatus: "MANY_SEATS_AVAILABLE",
      horizon: "predicted",
      tripId: "SYD_T1",
      routeId: "SYD_R1",
    });
    expect(tripUpdateObservations[1]).toMatchObject({
      stopId: "S2",
      occupancyStatus: "STANDING_ROOM_ONLY",
    });

    const vehicleObservations = result.data.filter(
      (o) => o.source === "tfnsw-gtfs-rt-vehicle-position",
    );
    expect(vehicleObservations).toHaveLength(2);
    expect(vehicleObservations).toContainEqual(
      expect.objectContaining({
        carriageNumber: 1,
        occupancyStatus: "EMPTY",
        horizon: "actual",
      }),
    );
    expect(vehicleObservations).toContainEqual(
      expect.objectContaining({
        carriageNumber: 2,
        occupancyStatus: "FEW_SEATS_AVAILABLE",
      }),
    );
  });

  it("documents a known limitation: an unset departureOccupancyStatus decodes indistinguishably from an explicit EMPTY (proto3 zero-value semantics, not a bug in this client)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(buildFeed()),
    );

    const result = await fetchOccupancyObservations({
      feedUrl: "https://example.test/gtfsrt/tripupdates",
      apiKey: "test-key",
      regionId: "au-nsw-sydney",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const s3 = result.data.find((o) => o.stopId === "S3");
      // Regression pin: if this ever changes (e.g. package upgrade starts
      // preserving proto3 field presence), the module header's documented
      // limitation needs updating to match, not just this assertion.
      expect(s3?.occupancyStatus).toBe("EMPTY");
    }
  });

  it("skips a stop that explicitly reports NO_DATA_AVAILABLE, unlike a silently-unset field", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(buildFeed()),
    );

    const result = await fetchOccupancyObservations({
      feedUrl: "https://example.test/gtfsrt/tripupdates",
      apiKey: "test-key",
      regionId: "au-nsw-sydney",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.some((o) => o.stopId === "S4")).toBe(false);
    }
  });

  it("sends the TfNSW apikey Authorization header", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(buildFeed()));

    await fetchOccupancyObservations({
      feedUrl: "https://example.test/gtfsrt/tripupdates",
      apiKey: "secret-key",
      regionId: "au-nsw-sydney",
    });

    const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("apikey secret-key");
  });

  it("returns an http_error result when the feed responds with an error status", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("nope", { status: 503 }),
    );

    const result = await fetchOccupancyObservations({
      feedUrl: "https://example.test/gtfsrt/tripupdates",
      apiKey: "test-key",
      regionId: "au-nsw-sydney",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("http_error");
    }
  });

  it("returns an offline error result when the request throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await fetchOccupancyObservations({
      feedUrl: "https://example.test/gtfsrt/tripupdates",
      apiKey: "test-key",
      regionId: "au-nsw-sydney",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("offline");
    }
  });

  it("returns a validation_error result when the response body is not a valid FeedMessage", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(new Uint8Array([1, 2, 3, 255, 255, 255])),
    );

    const result = await fetchOccupancyObservations({
      feedUrl: "https://example.test/gtfsrt/tripupdates",
      apiKey: "test-key",
      regionId: "au-nsw-sydney",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });
});
