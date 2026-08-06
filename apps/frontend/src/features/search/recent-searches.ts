import { getJson, setJson } from "@/lib/kv-store";

export type RecentSearch = {
  fromStationId: string;
  toStationId: string;
  searchedAt: string;
};

const KEY = "recent_searches";
const MAX_RECENT = 5;

// 3.4: recent search conditions, persisted so they survive app restarts
// (kv-store, matching design.md's `recent_searches` key).
export async function addRecentSearch(
  search: Pick<RecentSearch, "fromStationId" | "toStationId">,
): Promise<void> {
  const existing = await getRecentSearches();
  const deduped = existing.filter(
    (entry) =>
      !(
        entry.fromStationId === search.fromStationId &&
        entry.toStationId === search.toStationId
      ),
  );
  const updated: RecentSearch[] = [
    { ...search, searchedAt: new Date().toISOString() },
    ...deduped,
  ].slice(0, MAX_RECENT);
  await setJson(KEY, updated);
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  return (await getJson<RecentSearch[]>(KEY)) ?? [];
}
