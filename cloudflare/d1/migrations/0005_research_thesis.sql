CREATE TABLE IF NOT EXISTS research_thesis_runs (
  run_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  spec_json TEXT,
  candidate_delta_json TEXT,
  audit_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_thesis_runs_status_updated_at
  ON research_thesis_runs(status, updated_at);
