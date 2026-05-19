CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  mode TEXT NOT NULL,
  amount_total INTEGER,
  currency TEXT,
  customer_id TEXT,
  customer_email TEXT,
  url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_workspace_updated
  ON stripe_checkout_sessions(workspace_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_sessions_payment_status
  ON stripe_checkout_sessions(payment_status, updated_at);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  payload_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_received
  ON stripe_webhook_events(event_type, received_at);
