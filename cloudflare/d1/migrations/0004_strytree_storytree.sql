CREATE TABLE IF NOT EXISTS strytree_users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strytree_users_auth_subject
  ON strytree_users(auth_subject)
  WHERE auth_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS strytree_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  anonymous_subject TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  linked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES strytree_users(id)
);

CREATE INDEX IF NOT EXISTS idx_strytree_sessions_user_expires
  ON strytree_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS strytree_stories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  tagline TEXT,
  status TEXT NOT NULL,
  poster_object_key TEXT,
  root_node_id TEXT,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strytree_nodes (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  parent_node_id TEXT,
  selected_candidate_id TEXT,
  creator_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  prompt TEXT,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  is_free_window INTEGER NOT NULL DEFAULT 1,
  unlock_price_credits INTEGER NOT NULL DEFAULT 0,
  video_object_key TEXT,
  thumbnail_object_key TEXT,
  age_days INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  impressions_count INTEGER NOT NULL DEFAULT 0,
  paid_unlocks_count INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES strytree_stories(id),
  FOREIGN KEY (parent_node_id) REFERENCES strytree_nodes(id),
  FOREIGN KEY (creator_user_id) REFERENCES strytree_users(id)
);

CREATE INDEX IF NOT EXISTS idx_strytree_nodes_story_parent
  ON strytree_nodes(story_id, parent_node_id);

CREATE INDEX IF NOT EXISTS idx_strytree_nodes_story_status
  ON strytree_nodes(story_id, status, moderation_status, visibility);

CREATE TABLE IF NOT EXISTS strytree_assets (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  owner_node_id TEXT,
  asset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  ref_name TEXT,
  external_provider_image_id TEXT,
  object_key TEXT,
  prompt_prefix TEXT,
  negative_prompt TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES strytree_stories(id),
  FOREIGN KEY (owner_node_id) REFERENCES strytree_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_strytree_assets_story_owner
  ON strytree_assets(story_id, owner_node_id);

CREATE TABLE IF NOT EXISTS strytree_node_asset_refs (
  node_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  ref_role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (node_id, asset_id, ref_role),
  FOREIGN KEY (node_id) REFERENCES strytree_nodes(id),
  FOREIGN KEY (asset_id) REFERENCES strytree_assets(id)
);

CREATE TABLE IF NOT EXISTS strytree_unlocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  ledger_event_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, node_id),
  FOREIGN KEY (user_id) REFERENCES strytree_users(id),
  FOREIGN KEY (node_id) REFERENCES strytree_nodes(id)
);

CREATE TABLE IF NOT EXISTS strytree_token_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount_credits INTEGER NOT NULL,
  balance_after_credits INTEGER NOT NULL,
  related_object_type TEXT,
  related_object_id TEXT,
  provider_event_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES strytree_users(id)
);

CREATE INDEX IF NOT EXISTS idx_strytree_token_ledger_user_created
  ON strytree_token_ledger(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_strytree_token_ledger_related
  ON strytree_token_ledger(related_object_type, related_object_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strytree_token_ledger_provider_event
  ON strytree_token_ledger(provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS strytree_payment_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_session_id TEXT,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  credit_amount INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES strytree_users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strytree_payment_sessions_provider
  ON strytree_payment_sessions(provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS strytree_generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  status TEXT NOT NULL,
  debit_ledger_event_id TEXT,
  refund_ledger_event_id TEXT,
  provider TEXT NOT NULL,
  provider_job_id TEXT,
  request_json TEXT NOT NULL,
  result_json TEXT,
  fallback_artifact_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES strytree_users(id),
  FOREIGN KEY (story_id) REFERENCES strytree_stories(id),
  FOREIGN KEY (parent_node_id) REFERENCES strytree_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_strytree_generation_jobs_user_status
  ON strytree_generation_jobs(user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS strytree_candidate_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  status TEXT NOT NULL,
  max_candidates INTEGER NOT NULL,
  quoted_cost_credits INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_json TEXT NOT NULL,
  scorecard_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (max_candidates >= 1 AND max_candidates <= 3),
  FOREIGN KEY (user_id) REFERENCES strytree_users(id),
  FOREIGN KEY (story_id) REFERENCES strytree_stories(id),
  FOREIGN KEY (parent_node_id) REFERENCES strytree_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_strytree_candidate_runs_user_parent
  ON strytree_candidate_runs(user_id, parent_node_id, created_at);

CREATE TABLE IF NOT EXISTS strytree_branch_candidates (
  id TEXT PRIMARY KEY,
  candidate_run_id TEXT NOT NULL,
  generation_job_id TEXT,
  user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  synopsis TEXT,
  prompt TEXT,
  video_object_key TEXT,
  thumbnail_object_key TEXT,
  credit_cost INTEGER NOT NULL DEFAULT 0,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  inherited_asset_count INTEGER NOT NULL DEFAULT 0,
  continuity_score REAL NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  publish_eligible INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  token_cost_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (candidate_run_id) REFERENCES strytree_candidate_runs(id),
  FOREIGN KEY (generation_job_id) REFERENCES strytree_generation_jobs(id),
  FOREIGN KEY (user_id) REFERENCES strytree_users(id),
  FOREIGN KEY (story_id) REFERENCES strytree_stories(id),
  FOREIGN KEY (parent_node_id) REFERENCES strytree_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_strytree_branch_candidates_run
  ON strytree_branch_candidates(candidate_run_id, status, publish_eligible);

CREATE TABLE IF NOT EXISTS strytree_candidate_merge_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  selected_candidate_id TEXT NOT NULL,
  status TEXT NOT NULL,
  merge_json TEXT NOT NULL,
  published_node_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES strytree_users(id),
  FOREIGN KEY (story_id) REFERENCES strytree_stories(id),
  FOREIGN KEY (parent_node_id) REFERENCES strytree_nodes(id),
  FOREIGN KEY (selected_candidate_id) REFERENCES strytree_branch_candidates(id),
  FOREIGN KEY (published_node_id) REFERENCES strytree_nodes(id)
);

CREATE TABLE IF NOT EXISTS strytree_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strytree_audit_events_object
  ON strytree_audit_events(object_type, object_id, created_at);

CREATE INDEX IF NOT EXISTS idx_strytree_audit_events_actor
  ON strytree_audit_events(actor_user_id, created_at);
