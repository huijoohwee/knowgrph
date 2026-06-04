DROP TABLE IF EXISTS stripe_webhook_events_next;

CREATE TABLE IF NOT EXISTS stripe_webhook_events_next (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  payload_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  processing_status TEXT NOT NULL DEFAULT 'processed',
  processing_error TEXT
);

INSERT INTO stripe_webhook_events_next (
  id,
  event_type,
  livemode,
  payload_hash,
  received_at,
  processed_at,
  processing_status,
  processing_error
)
SELECT
  id,
  event_type,
  livemode,
  payload_hash,
  received_at,
  processed_at,
  'processed',
  NULL
FROM stripe_webhook_events;

DROP TABLE stripe_webhook_events;

ALTER TABLE stripe_webhook_events_next RENAME TO stripe_webhook_events;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_received
  ON stripe_webhook_events(event_type, received_at);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processing_status
  ON stripe_webhook_events(processing_status, received_at);
