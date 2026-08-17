/**
 * Parses a GTFS-JP static feed zip into this repo's timetable dataset shape
 * (`stationSchema`/`tripSchema`, packages/shared/src/schemas/dataset.schema.ts).
 *
 * Scope (design doc §5.2/§6, docs/superpowers/specs/2026-08-13-transit-data-sourcing-design.md):
 * reads the standard GTFS files (stops/routes/trips/stop_times/calendar) that
 * GTFS-JP feeds carry alongside their Japan-specific extension files
 * (agency_jp.txt etc., which we don't need). It does not implement the P1
 * fix (branch/loop-aware station ordering) -- callers must pass a single
 * linear, non-branching `routeId` and station range, matching the MVP scope
 * guardrail in docs/pm/review-seatsignal-idea-2026-08-04.md ("1路線・乗換なし・
 * 5〜10駅区間"). A branching or looping route (e.g. Toei Oedo Line) is
 * rejected rather than silently mis-ordered.
 *
 * This is ingestion tooling (apps/backend/scripts/), not a deployed Workers
 * dependency -- see apps/backend/CLAUDE.md.
 */
import { unzipSync } from "fflate";
import {
  type AppError,
  createAppError,
  type DayType,
  err,
  ok,
  type Result,
} from "shared";

export type GtfsStation = {
  id: string;
  nameJa: string;
  nameEn: string;
  seq: number;
};

type GtfsStopTime = {
  stopId: string;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
};

export type GtfsTrip = {
  tripId: string;
  dayType: DayType;
  carCount: number;
  stopTimes: GtfsStopTime[];
};

export type GtfsParseOptions = {
  /** GTFS `route_id` to filter to. Must be a single, non-branching line. */
  routeId: string;
  /**
   * `stop_id`s of the target station range, in timetable order. GTFS has no
   * concept of "car count", so this range also bounds how many trips get
   * parsed -- trips are dropped if their stop_times don't cover this exact
   * ordered subsequence (handles both directions by reversing internally).
   */
  stopIds: string[];
  /**
   * Train car count is not a standard GTFS field and GTFS-JP does not
   * reliably carry it either -- this must come from an independent source
   * (the operator's published rolling-stock info), not fabricated here.
   */
  carCount: number;
};

type CsvTable = Array<Record<string, string>>;

function parseCsv(text: string): CsvTable {
  // Strip a UTF-8 BOM, which Japanese GTFS feeds commonly include.
  const content = text.startsWith("﻿") ? text.slice(1) : text;
  const rows = splitCsvRows(content);
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = row[index] ?? "";
    });
    return record;
  });
}

/** Minimal RFC4180 field/row splitter: handles quoted fields with embedded commas, quotes, and newlines. */
function splitCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && content[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "") || row.length > 1) {
        rows.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readFile(
  entries: Record<string, Uint8Array>,
  name: string,
): CsvTable | null {
  const bytes = entries[name];
  if (!bytes) {
    return null;
  }
  return parseCsv(new TextDecoder("utf-8").decode(bytes));
}

function toHms(gtfsTime: string): string {
  // GTFS allows hour >= 24 for post-midnight service; normalize into 00-23
  // to match this repo's clockTimeSchema (HH:mm on a 24h clock).
  const [hh, mm] = gtfsTime.split(":");
  const hour = ((Number(hh) % 24) + 24) % 24;
  return `${String(hour).padStart(2, "0")}:${mm}`;
}

function calendarDayType(row: Record<string, string> | undefined): DayType {
  if (!row) {
    return "weekday";
  }
  const isWeekday =
    row.monday === "1" ||
    row.tuesday === "1" ||
    row.wednesday === "1" ||
    row.thursday === "1" ||
    row.friday === "1";
  return isWeekday ? "weekday" : "weekend";
}

export function parseGtfsStaticZip(
  zipBytes: Uint8Array,
  options: GtfsParseOptions,
): Result<{ stations: GtfsStation[]; trips: GtfsTrip[] }, AppError> {
  if (options.stopIds.length < 2) {
    return err(
      createAppError(
        "validation_error",
        "stopIds must contain at least 2 stations",
      ),
    );
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch (cause) {
    return err(
      createAppError("validation_error", "Failed to unzip GTFS feed", cause),
    );
  }

  const stopsTable = readFile(entries, "stops.txt");
  const tripsTable = readFile(entries, "trips.txt");
  const stopTimesTable = readFile(entries, "stop_times.txt");
  const calendarTable = readFile(entries, "calendar.txt");

  if (!stopsTable || !tripsTable || !stopTimesTable) {
    return err(
      createAppError(
        "validation_error",
        "GTFS feed is missing stops.txt, trips.txt, or stop_times.txt",
      ),
    );
  }

  const stopNameById = new Map(
    stopsTable.map((s) => [s.stop_id, s.stop_name ?? ""]),
  );
  const stationOrder = new Map(options.stopIds.map((id, i) => [id, i]));

  const stations: GtfsStation[] = options.stopIds.map((id, seq) => ({
    id,
    nameJa: stopNameById.get(id) ?? id,
    // GTFS-JP does not reliably carry a separate English stop name; fall
    // back to the Japanese name rather than fabricate a translation.
    nameEn: stopNameById.get(id) ?? id,
    seq,
  }));
  const missingStops = options.stopIds.filter((id) => !stopNameById.has(id));
  if (missingStops.length > 0) {
    return err(
      createAppError(
        "validation_error",
        `stops.txt has no entry for: ${missingStops.join(", ")}`,
      ),
    );
  }

  const calendarByServiceId = new Map(
    (calendarTable ?? []).map((row) => [row.service_id, row]),
  );
  const routeTripIds = new Set(
    tripsTable
      .filter((t) => t.route_id === options.routeId)
      .map((t) => t.trip_id),
  );
  if (routeTripIds.size === 0) {
    return err(
      createAppError(
        "validation_error",
        `No trips found for route_id=${options.routeId}`,
      ),
    );
  }
  const serviceIdByTripId = new Map(
    tripsTable
      .filter((t) => routeTripIds.has(t.trip_id))
      .map((t) => [t.trip_id, t.service_id]),
  );

  const stopTimesByTrip = new Map<string, Record<string, string>[]>();
  for (const row of stopTimesTable) {
    if (!routeTripIds.has(row.trip_id)) {
      continue;
    }
    const list = stopTimesByTrip.get(row.trip_id) ?? [];
    list.push(row);
    stopTimesByTrip.set(row.trip_id, list);
  }

  const trips: GtfsTrip[] = [];
  for (const [tripId, rawStopTimes] of stopTimesByTrip) {
    const withinRange = rawStopTimes
      .filter((r) => stationOrder.has(r.stop_id))
      .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));

    if (withinRange.length !== options.stopIds.length) {
      // Trip doesn't run through the full target station range -- out of
      // MVP scope for this line segment, skip it rather than emit a partial
      // (and therefore misleading) timetable entry.
      continue;
    }

    const orderIndices = withinRange.map(
      (r) => stationOrder.get(r.stop_id) as number,
    );
    const isForward = orderIndices.every(
      (v, i, arr) => i === 0 || v === arr[i - 1] + 1,
    );
    const isReverse = orderIndices.every(
      (v, i, arr) => i === 0 || v === arr[i - 1] - 1,
    );
    if (!isForward && !isReverse) {
      // Branching/looping topology within the requested range (e.g. Oedo
      // Line) -- P1 (station.seq is a single line integer) can't represent
      // this yet. Fail loudly instead of emitting a corrupted stop order.
      return err(
        createAppError(
          "validation_error",
          `trip ${tripId} does not run through stopIds in a single consistent direction (branching/loop route?)`,
        ),
      );
    }

    const ordered = isForward ? withinRange : [...withinRange].reverse();
    trips.push({
      tripId,
      dayType: calendarDayType(
        calendarByServiceId.get(serviceIdByTripId.get(tripId) ?? ""),
      ),
      carCount: options.carCount,
      stopTimes: ordered.map((r, i) => ({
        stopId: r.stop_id,
        stopSequence: i,
        arrivalTime: toHms(r.arrival_time),
        departureTime: toHms(r.departure_time),
      })),
    });
  }

  if (trips.length === 0) {
    return err(
      createAppError(
        "validation_error",
        "No trips run through the full requested station range",
      ),
    );
  }

  return ok({ stations, trips });
}
