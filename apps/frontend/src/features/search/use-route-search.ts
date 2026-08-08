import { useQuery } from "@tanstack/react-query";
import { type AppError, err, isErr, type Result, toDayType } from "shared";

import {
  getCongestionData,
  getCorrectionData,
  getTimetableData,
} from "@/features/dataset/dataset-repository";
import { createSqliteDatasetStore } from "@/features/dataset/dataset-store";
import { usePreferenceStore } from "@/features/preferences/preference-store";
import { analyticsClient } from "@/lib/analytics";
import { floorToTimeBucket } from "@/lib/clock-time";
import { getDb } from "@/lib/db";
import { addRecentSearch } from "./recent-searches";
import type { RankedRoute } from "./route-ranker";
import { rankRoutes } from "./route-ranker";
import { searchRoutes } from "./route-search-engine";

export type RouteSearchQuery = {
  fromStationId: string;
  toStationId: string;
  departureTime: string;
  serviceDate?: string;
};

function resolveDayType(serviceDate: string | undefined) {
  if (!serviceDate) {
    return toDayType(new Date());
  }

  // Use midday in the local timezone so a YYYY-MM-DD query does not shift to
  // the previous date on devices west of UTC.
  const parsed = new Date(`${serviceDate}T12:00:00`);
  return Number.isNaN(parsed.valueOf())
    ? toDayType(new Date())
    : toDayType(parsed);
}

// 検索実行 hook（design.md: "無料枠チェック→検索→3案選定"）-- the free-tier
// check is deliberately NOT here yet: it's task 6.4's explicit job
// ("無料プラン制限を検索・比較・詳細画面へ統合する"), which doesn't exist
// yet. This hook owns search execution + 3-option selection only.
export function useRouteSearch(query: RouteSearchQuery | null) {
  const preference = usePreferenceStore((state) => state.preference);

  return useQuery({
    queryKey: ["route-search", query, preference],
    enabled: query !== null,
    queryFn: async (): Promise<Result<RankedRoute[], AppError>> => {
      if (!query) {
        // Unreachable given `enabled`, but keeps the function total.
        return err({ code: "unknown", message: "No search query" });
      }

      // 17.1/10.1: "検索開始" -- fires once per actual queryFn invocation
      // (react-query dedupes by queryKey, so a cache hit doesn't re-fire this).
      analyticsClient.track("search_started", {
        timeBucket: floorToTimeBucket(query.departureTime),
      });

      const db = await getDb();
      const store = createSqliteDatasetStore(db);
      const dayType = resolveDayType(query.serviceDate);

      const [timetableResult, congestionResult, correctionResult] =
        await Promise.all([
          getTimetableData(store),
          getCongestionData(store),
          getCorrectionData(store),
        ]);
      if (isErr(timetableResult)) {
        return err(timetableResult.error);
      }
      if (isErr(congestionResult)) {
        return err(congestionResult.error);
      }
      if (isErr(correctionResult)) {
        return err(correctionResult.error);
      }

      const searchResult = searchRoutes(timetableResult.data, {
        fromStationId: query.fromStationId,
        toStationId: query.toStationId,
        departureTime: query.departureTime,
        dayType,
      });
      if (isErr(searchResult)) {
        return err(searchResult.error);
      }

      const ranked = rankRoutes(
        searchResult.data,
        timetableResult.data,
        congestionResult.data,
        correctionResult.data,
        preference,
        dayType,
      );

      if (!isErr(ranked)) {
        // 3.4: record this search regardless of how many results it
        // produced, so it's available to re-run from "recent searches".
        await addRecentSearch({
          fromStationId: query.fromStationId,
          toStationId: query.toStationId,
        });
        // 17.1/10.1: "検索完了" -- only on a successful search, matching the
        // funnel's next step (results.tsx's route comparison view) actually
        // having something to render.
        analyticsClient.track("search_completed", {
          timeBucket: floorToTimeBucket(query.departureTime),
        });
      }

      return ranked;
    },
  });
}
