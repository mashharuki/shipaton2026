import type {
  FeedbackOutcomeSelection,
  VsExpectedAnswer,
} from "@/features/feedback/use-feedback";
import type { RouteLeg } from "@/features/search/route-search-engine";
import type { DbPort } from "@/lib/db";

type TripFeedbackSummary = FeedbackOutcomeSelection & {
  vsExpected?: VsExpectedAnswer;
};

type TripRecord = {
  tripId: string;
  legs: RouteLeg[];
  startedAt: string;
  endedAt: string;
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
  feedback_json: string | null;
};

function rowToRecord(row: TripRow): TripRecord {
  return {
    tripId: row.trip_id,
    legs: JSON.parse(row.route_json),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    feedback: row.feedback_json ? JSON.parse(row.feedback_json) : null,
  };
}

export function createSqliteTripHistoryStore(db: DbPort): TripHistoryStore {
  return {
    async saveTrip(record) {
      await db.runAsync(
        `INSERT INTO trips (trip_id, route_json, started_at, ended_at, feedback_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(trip_id) DO UPDATE SET
           route_json = excluded.route_json,
           started_at = excluded.started_at,
           ended_at = excluded.ended_at,
           feedback_json = excluded.feedback_json;`,
        [
          record.tripId,
          JSON.stringify(record.legs),
          record.startedAt,
          record.endedAt,
          record.feedback ? JSON.stringify(record.feedback) : null,
        ],
      );
    },

    async listTrips() {
      const rows = await db.getAllAsync<TripRow>(
        "SELECT trip_id, route_json, started_at, ended_at, feedback_json FROM trips ORDER BY started_at DESC;",
      );
      return rows.map(rowToRecord);
    },
  };
}
