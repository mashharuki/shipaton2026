import { FREE_SAVED_ROUTE_LIMIT, type WEEKDAYS } from "shared";

import type { SpeedComfortBalance } from "@/features/preferences/preference-store";
import type { DbPort } from "@/lib/db";

export type Weekday = (typeof WEEKDAYS)[number];

export type SavedRoute = {
  id: string;
  fromStationId: string;
  toStationId: string;
  weekdays: Weekday[];
  departureTime: string;
  comfortPriority: SpeedComfortBalance;
  createdAt: string;
};

export type NewSavedRoute = Omit<SavedRoute, "id" | "createdAt">;

// design.md: "saved-routes-store.ts -- 保存ルート CRUD（SQLite）＋Free 1 件
// 制限". The CRUD half is the SQLite adapter at the bottom of this file
// (untested -- native-runtime-only, no branching, same precedent as
// dataset-store.ts / trip-history-repository.ts). The Free-limit *decision*
// and the Undo-window mechanism are the parts actually worth verifying, so
// they're plain functions any caller (the use-saved-routes.ts hook) composes
// with the port below.
export type SavedRoutesStore = {
  list(): Promise<SavedRoute[]>;
  insert(route: SavedRoute): Promise<void>;
  remove(id: string): Promise<void>;
};

// 9.2/9.3: Free may hold FREE_SAVED_ROUTE_LIMIT (1) saved route; the 2nd save
// attempt must trigger the Paywall. subscription-gate's `guard({ type:
// "saved_route_limit" })` blocks unconditionally for a free user (its own
// comment: "the caller only invokes guard() with these trigger types once it
// has already determined the action needs Pro") -- this function is that
// upstream decision, made from the caller's own saved-route count instead of
// duplicating limit state inside subscription-gate.
export function canSaveMoreRoutes(
  currentCount: number,
  isPro: boolean,
): boolean {
  return isPro || currentCount < FREE_SAVED_ROUTE_LIMIT;
}

export const UNDO_WINDOW_MS = 5000;

// 9.6: delete-with-Undo instead of a blocking confirm dialog. `commit` only
// runs if `cancel()` isn't called first -- callers hide the row immediately
// and call `cancel()` if the user taps Undo before delayMs elapses.
export function scheduleUndoableRemoval(
  commit: () => void,
  delayMs: number = UNDO_WINDOW_MS,
): { cancel: () => void } {
  const timer = setTimeout(commit, delayMs);
  return {
    cancel: () => clearTimeout(timer),
  };
}

type SavedRouteRow = {
  id: string;
  from_station_id: string;
  to_station_id: string;
  weekdays_json: string;
  departure_time: string;
  comfort_priority: string;
  created_at: string;
};

function rowToSavedRoute(row: SavedRouteRow): SavedRoute {
  return {
    id: row.id,
    fromStationId: row.from_station_id,
    toStationId: row.to_station_id,
    weekdays: JSON.parse(row.weekdays_json),
    departureTime: row.departure_time,
    comfortPriority: row.comfort_priority as SpeedComfortBalance,
    createdAt: row.created_at,
  };
}

export function createSqliteSavedRoutesStore(db: DbPort): SavedRoutesStore {
  return {
    async list() {
      const rows = await db.getAllAsync<SavedRouteRow>(
        `SELECT id, from_station_id, to_station_id, weekdays_json, departure_time, comfort_priority, created_at
         FROM saved_routes ORDER BY created_at ASC;`,
      );
      return rows.map(rowToSavedRoute);
    },

    async insert(route) {
      await db.runAsync(
        `INSERT INTO saved_routes (id, from_station_id, to_station_id, weekdays_json, departure_time, comfort_priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          route.id,
          route.fromStationId,
          route.toStationId,
          JSON.stringify(route.weekdays),
          route.departureTime,
          route.comfortPriority,
          route.createdAt,
        ],
      );
    },

    async remove(id) {
      await db.runAsync("DELETE FROM saved_routes WHERE id = ?;", [id]);
    },
  };
}
