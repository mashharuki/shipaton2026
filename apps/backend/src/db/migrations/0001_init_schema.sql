-- D1 schema for SeatSignal backend (design.md "Physical Data Model" > D1).
-- Doubles as the migration (design.md db/schema.sql note) -- the SQL DDL here IS
-- the schema, applied via wrangler's D1 migrations tooling and, in tests, via
-- readD1Migrations()/applyD1Migrations() from @cloudflare/vitest-pool-workers.
-- Enum-like CHECK constraints mirror the source-of-truth unions in
-- packages/shared/src/schemas/{api,dataset,analytics-events}.schema.ts.

-- Requirements: 8.6, 16.2, 16.3
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  railway_id TEXT NOT NULL,
  leg_key TEXT NOT NULL,
  time_bucket TEXT NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'weekend')),
  seated_outcome TEXT NOT NULL CHECK (
    seated_outcome IN (
      'seated_from_start',
      'seated_from_middle',
      'stood_whole_trip'
    )
  ),
  seated_station_id TEXT,
  vs_expected TEXT CHECK (
    vs_expected IN (
      'less_crowded_than_expected',
      'as_expected',
      'more_crowded_than_expected'
    )
  ),
  predicted_standing_min REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_feedback_created_at ON feedback (created_at);
CREATE INDEX idx_feedback_agg_key ON feedback (
  railway_id, leg_key, time_bucket, day_type
);

-- Requirements: 5.9, 8.6, 8.8, 16.3
CREATE TABLE correction_stats (
  railway_id TEXT NOT NULL,
  leg_key TEXT NOT NULL,
  time_bucket TEXT NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'weekend')),
  delta_score REAL NOT NULL,
  sample_n INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (railway_id, leg_key, time_bucket, day_type)
);

-- Requirements: 5.9 (MAE measurement -- single target line, see product.md scope guardrails)
CREATE TABLE metrics (
  date TEXT PRIMARY KEY,
  railway_id TEXT NOT NULL,
  mae_standing_min REAL NOT NULL,
  n INTEGER NOT NULL
);

-- Requirements: 17.1, 17.2, 17.5
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  props_json TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_analytics_events_created_at ON analytics_events (created_at);

-- Requirements: 10.1-10.5
CREATE TABLE push_registrations (
  id TEXT PRIMARY KEY,
  expo_push_token TEXT NOT NULL,
  from_station_id TEXT NOT NULL,
  to_station_id TEXT NOT NULL,
  weekdays TEXT NOT NULL,
  notify_at TEXT NOT NULL,
  lead_minutes INTEGER NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ja', 'en')),
  last_sent_date TEXT
);

CREATE INDEX idx_push_registrations_notify_at ON push_registrations (notify_at);
