import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import {
  DATASET_SYNC_QUERY_KEY,
  HOME_DATASETS_QUERY_KEY,
} from "./dataset-query-keys";
import { syncDatasets } from "./dataset-repository";
import { createSqliteDatasetStore } from "./dataset-store";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 4.3: runs on mount (app startup) and every 24h thereafter. react-query
// keeps the previously synced state on failure (it never clears cached data
// just because a refetch rejected), which is exactly the "sync 失敗時も
// 既存データで動作継続" behavior design.md asks for -- no extra retry/
// fallback logic needed here.
//
// Fix round 1 (Task 7): index.tsx's own `home-datasets` read is a one-shot
// query, fired from its own mount -- on a genuinely fresh install it reads
// the (still-empty) local store before this sync has written anything, and
// nothing was ever telling it to look again once the sync landed (no
// `invalidateQueries` existed anywhere in this app). Invalidating
// `HOME_DATASETS_QUERY_KEY` here, once this queryFn settles, is what closes
// that gap -- unconditionally (via `finally`), not just on success: a
// failed/partial sync never clears the local store (syncOne's own
// early-return-on-failure keeps whatever was already persisted, per
// design.md's offline-viewing requirement, 15.2), so re-reading it after a
// failed sync is always safe and never regresses what home-datasets would
// otherwise have shown -- it just stops that read from being permanently
// stuck on a stale (often empty) first attempt.
export function useDatasetSync() {
  const queryClient = useQueryClient();
  useQuery({
    queryKey: DATASET_SYNC_QUERY_KEY,
    queryFn: async () => {
      const db = await getDb();
      try {
        await syncDatasets(createSqliteDatasetStore(db));
      } finally {
        await queryClient.invalidateQueries({
          queryKey: HOME_DATASETS_QUERY_KEY,
        });
      }
      return true;
    },
    refetchInterval: ONE_DAY_MS,
    staleTime: ONE_DAY_MS,
    retry: false,
  });
}
