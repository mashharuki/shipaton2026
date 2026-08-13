import type { QueryKey } from "@tanstack/react-query";

// Shared between use-dataset-sync.ts (which invalidates this key once a
// sync attempt finishes) and app/(tabs)/index.tsx (which reads it) so the
// two queries never drift apart into two different bare string literals.
export const HOME_DATASETS_QUERY_KEY: QueryKey = ["home-datasets"];

export const DATASET_SYNC_QUERY_KEY: QueryKey = ["dataset-sync"];
