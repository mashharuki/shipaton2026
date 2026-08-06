import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { syncDatasets } from "./dataset-repository";
import { createSqliteDatasetStore } from "./dataset-store";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 4.3: runs on mount (app startup) and every 24h thereafter. react-query
// keeps the previously synced state on failure (it never clears cached data
// just because a refetch rejected), which is exactly the "sync 失敗時も
// 既存データで動作継続" behavior design.md asks for -- no extra retry/
// fallback logic needed here.
export function useDatasetSync() {
  useQuery({
    queryKey: ["dataset-sync"],
    queryFn: async () => {
      const db = await getDb();
      await syncDatasets(createSqliteDatasetStore(db));
      return true;
    },
    refetchInterval: ONE_DAY_MS,
    staleTime: ONE_DAY_MS,
    retry: false,
  });
}
