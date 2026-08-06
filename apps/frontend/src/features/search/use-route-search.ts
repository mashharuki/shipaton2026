import { useQuery } from "@tanstack/react-query";
import { type AppError, err, isErr, type Result, toDayType } from "shared";

import {
  getCongestionData,
  getCorrectionData,
  getTimetableData,
} from "@/features/dataset/dataset-repository";
import { createSqliteDatasetStore } from "@/features/dataset/dataset-store";
import { usePreferenceStore } from "@/features/preferences/preference-store";
import { getDb } from "@/lib/db";
import { addRecentSearch } from "./recent-searches";
import type { RankedRoute } from "./route-ranker";
import { rankRoutes } from "./route-ranker";
import { searchRoutes } from "./route-search-engine";

export type RouteSearchQuery = {
  fromStationId: string;
  toStationId: string;
  departureTime: string;
};

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

      const db = await getDb();
      const store = createSqliteDatasetStore(db);
      const dayType = toDayType(new Date());

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
      }

      return ranked;
    },
  });
}
