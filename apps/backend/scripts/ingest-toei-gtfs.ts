/**
 * M3 (docs/superpowers/specs/2026-08-13-transit-data-sourcing-design.md §8):
 * "①を新設。Transitland ライセンスゲート＋都営 GTFS-JP 取り込み。完了条件: 東京が実時刻表で動く"
 *
 * Pulls a real Toei (東京都交通局) line's static timetable through the
 * Transitland license gate and writes it as a `gtfs_import` timetable
 * dataset payload, in the same fixture format `generate-datasets.ts`
 * produces for the synthetic demo line.
 *
 * ## Why this writes a SEPARATE file instead of replacing timetable.json
 *
 * The app's served demo line (RAIL_CHUO) is threaded through
 * `ODPT_RAILWAY_IDS` (src/services/odpt-client.ts), the congestion/
 * correction synthetic generators (which key on the SAME station IDs as
 * the timetable), and every existing shared/backend/frontend/E2E fixture.
 * Swapping the *served* dataset to a Toei line is a deliberate follow-up
 * decision (which line, which 5-10 station range, regenerating matching
 * congestion profiles for the new legs, updating ODPT_RAILWAY_IDS, and
 * touching every fixture-dependent test) -- not something this script does
 * as a side effect. This script's job is narrower and matches M3's own
 * completion condition: prove Tokyo *can* run on a real, license-clean
 * timetable. Output goes to fixtures/datasets/timetable.gtfs-import.json.
 *
 * ## Running this for real
 *
 * This process's sandbox has no outbound network access (curl/wget are
 * denied by policy), so this script has been written but not executed
 * against live Transitland/ODPT endpoints. Run it yourself with:
 *
 *   TRANSITLAND_API_KEY=... pnpm --filter backend run ingest:toei -- \
 *     --route-id <GTFS route_id> \
 *     --stop-ids <comma-separated stop_ids, in order, 5-10 stations> \
 *     --car-count <integer, from Toei's published rolling-stock info> \
 *     [--operator-onestop-id o-xn76-toei] [--feed-onestop-id f-...]
 *
 * `--operator-onestop-id`/`--feed-onestop-id`/`--route-id`/`--stop-ids` are
 * not hardcoded here because this environment could not verify Transitland's
 * actual onestop_id for Toei or the real route_id/stop_id values against a
 * live response -- see the transitland-client.ts header comment. Discover
 * them with a first run passing only `--operator-onestop-id`/`--search`,
 * which lists every license-compatible feed Transitland returns.
 *
 * The GTFS zip itself is downloaded from Transitland's own **Feed Archive**
 * (`GET /feeds/{feed_key}/download_latest_feed_version`), not the operator's
 * origin URL -- see transitland-client.ts's module header for why.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { timetableDatasetPayloadSchema } from "shared";
import { parseGtfsStaticZip } from "./ingest/gtfs-jp-parser";
import {
  downloadLatestFeedVersion,
  searchLicenseCompatibleFeeds,
} from "./ingest/transitland-client";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token?.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        args[key] = value;
        i += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

/**
 * メイン関数
 * @returns
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // APIキーを取得
  const apiKey = process.env.TRANSITLAND_API_KEY;

  if (!apiKey) {
    console.error(
      "TRANSITLAND_API_KEY is required. Get one at https://www.transit.land/documentation/",
    );
    process.exitCode = 1;
    return;
  }

  const feedsResult = await searchLicenseCompatibleFeeds(apiKey, {
    operatorOnestopId: args["operator-onestop-id"],
    searchText:
      args.search ?? (args["operator-onestop-id"] ? undefined : "toei"),
  });

  if (!feedsResult.ok) {
    console.error("Transitland feed search failed:", feedsResult.error);
    process.exitCode = 1;
    return;
  }

  const feeds = feedsResult.data;
  if (feeds.length === 0) {
    console.error(
      "No license-compatible feeds found. Every feed Transitland returns for this query failed " +
        "the gate (commercial_use/create_derived_product/redistribution must all be 'yes') -- do " +
        "not widen the gate to force a result through.",
    );
    process.exitCode = 1;
    return;
  }

  const chosen = args["feed-onestop-id"]
    ? feeds.find((f) => f.onestopId === args["feed-onestop-id"])
    : feeds.length === 1
      ? feeds[0]
      : undefined;

  if (!chosen) {
    console.log(
      `${feeds.length} license-compatible feed(s) found. Re-run with --feed-onestop-id to pick one:`,
    );
    for (const feed of feeds) {
      console.log(`  ${feed.onestopId}  ${feed.name ?? "(no name)"}`);
    }
    process.exitCode = args["feed-onestop-id"] ? 1 : 0;
    return;
  }

  const routeId = args["route-id"];
  const stopIdsArg = args["stop-ids"];
  const carCountArg = args["car-count"];
  if (!routeId || !stopIdsArg || !carCountArg) {
    console.error(
      "Feed selected. Now pass --route-id, --stop-ids (comma-separated, in order), and " +
        "--car-count to parse a specific line/segment out of it.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Downloading latest feed version for ${chosen.onestopId} from Transitland's Feed Archive ...`,
  );
  const downloadResult = await downloadLatestFeedVersion(
    apiKey,
    chosen.onestopId,
  );
  if (!downloadResult.ok) {
    console.error("GTFS archive download failed:", downloadResult.error);
    process.exitCode = 1;
    return;
  }

  const parsed = parseGtfsStaticZip(downloadResult.data, {
    routeId,
    stopIds: stopIdsArg.split(","),
    carCount: Number(carCountArg),
  });
  if (!parsed.ok) {
    console.error("GTFS parse failed:", parsed.error);
    process.exitCode = 1;
    return;
  }

  const payload = timetableDatasetPayloadSchema.parse({
    schemaVersion: 1,
    provenance: "gtfs_import",
    feedAttribution: {
      feedOnestopId: chosen.onestopId,
      licenseSpdx: "CC-BY-4.0",
      attributionText: chosen.name ?? chosen.onestopId,
    },
    stations: parsed.data.stations,
    trips: parsed.data.trips,
  });

  const outPath = join(
    import.meta.dirname,
    "..",
    "fixtures",
    "datasets",
    "timetable.gtfs-import.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        version: `gtfs-import-${new Date().toISOString().slice(0, 10)}`,
        payload,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Wrote ${outPath} (${parsed.data.trips.length} trips, ${parsed.data.stations.length} stations)`,
  );
  console.log(
    "This file is NOT wired into the served dataset yet -- see this script's header comment.",
  );
}

main().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
