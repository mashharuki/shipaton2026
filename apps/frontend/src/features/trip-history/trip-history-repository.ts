import type {
  FeedbackOutcomeSelection,
  VsExpectedAnswer,
} from "@/features/feedback/use-feedback";
import type { RankedRouteType } from "@/features/search/route-ranker";
import type { RouteLeg } from "@/features/search/route-search-engine";
import type { DbPort } from "@/lib/db";

type TripFeedbackSummary = FeedbackOutcomeSelection & {
  vsExpected?: VsExpectedAnswer;
};

// Exported for 8.3's use-weekly-report.ts, which aggregates over these.
// `routeType`/`predictedStandingMinutes` are optional because a trip started
// before this task shipped (or reached via a path that doesn't have a ranked
// route, e.g. a future non-search entry point) may not carry them.
export type TripRecord = {
  tripId: string;
  legs: RouteLeg[];
  startedAt: string;
  endedAt: string;
  routeType?: RankedRouteType;
  predictedStandingMinutes?: number;
  feedback: TripFeedbackSummary | null;
};

// design.md's Physical Data Model `trips` table -- owned by this feature per
// task 7.3 ("乗車セッションの履歴を端末内にのみ保存する"). Same typed DbPort
// port as dataset-store.ts, for the same reason: lets 8.3/9.2 (weekly report,
// history deletion) depend on a fake in tests instead of real SQLite. Thin
// CRUD with no branching worth a dedicated unit test -- same untested-SQL-
// adapter precedent as dataset-store.ts.
export type TripHistoryStore = {
  saveTrip(record: TripRecord): Promise<void>;
  listTrips(): Promise<TripRecord[]>;
};

type TripRow = {
  trip_id: string;
  route_json: string;
  started_at: string;
  ended_at: string;
  route_type: string | null;
  predicted_standing_minutes: number | null;
  feedback_json: string | null;
};

function rowToRecord(row: TripRow): TripRecord {
  return {
    tripId: row.trip_id,
    legs: JSON.parse(row.route_json),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    ...(row.route_type ? { routeType: row.route_type as RankedRouteType } : {}),
    ...(row.predicted_standing_minutes !== null
      ? { predictedStandingMinutes: row.predicted_standing_minutes }
      : {}),
    feedback: row.feedback_json ? JSON.parse(row.feedback_json) : null,
  };
}

export function createSqliteTripHistoryStore(db: DbPort): TripHistoryStore {
  return {
    async saveTrip(record) {
      await db.runAsync(
        `INSERT INTO trips (trip_id, route_json, started_at, ended_at, route_type, predicted_standing_minutes, feedback_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(trip_id) DO UPDATE SET
           route_json = excluded.route_json,
           started_at = excluded.started_at,
           ended_at = excluded.ended_at,
           route_type = excluded.route_type,
           predicted_standing_minutes = excluded.predicted_standing_minutes,
           feedback_json = excluded.feedback_json;`,
        [
          record.tripId,
          JSON.stringify(record.legs),
          record.startedAt,
          record.endedAt,
          record.routeType ?? null,
          record.predictedStandingMinutes ?? null,
          record.feedback ? JSON.stringify(record.feedback) : null,
        ],
      );
    },

    async listTrips() {
      const rows = await db.getAllAsync<TripRow>(
        `SELECT trip_id, route_json, started_at, ended_at, route_type, predicted_standing_minutes, feedback_json
         FROM trips ORDER BY started_at DESC;`,
      );
      return rows.map(rowToRecord);
    },
  };
}
