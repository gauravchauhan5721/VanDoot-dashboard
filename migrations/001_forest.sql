CREATE TABLE IF NOT EXISTS forest_records (
 id text PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('incident','ranger','model','thermal')),
 payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forest_records_kind_updated ON forest_records(kind,updated_at DESC);
