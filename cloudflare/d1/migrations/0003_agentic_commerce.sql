CREATE TABLE IF NOT EXISTS agentic_commerce_sessions (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_rail TEXT NOT NULL,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payer_did TEXT,
  deposit_address TEXT,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  risk_signals_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agentic_commerce_sessions_seller_idempotency
  ON agentic_commerce_sessions(seller_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_agentic_commerce_sessions_status_updated
  ON agentic_commerce_sessions(status, updated_at);

CREATE TABLE IF NOT EXISTS agentic_commerce_proofs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  proof_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agentic_commerce_proofs_session
  ON agentic_commerce_proofs(session_id, created_at);

CREATE TABLE IF NOT EXISTS agentic_commerce_trace_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agentic_commerce_trace_events_session
  ON agentic_commerce_trace_events(session_id, created_at);
