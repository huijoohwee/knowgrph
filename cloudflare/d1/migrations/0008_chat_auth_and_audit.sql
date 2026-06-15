PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  invited_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_provider_policies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  allow_server_managed INTEGER NOT NULL DEFAULT 0,
  allow_byok INTEGER NOT NULL DEFAULT 1,
  monthly_request_limit INTEGER,
  monthly_token_limit INTEGER,
  monthly_spend_limit_cents INTEGER,
  default_model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, provider_id)
);

CREATE TABLE IF NOT EXISTS chat_proxy_audit (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  request_id TEXT,
  upstream_status INTEGER,
  relay_status TEXT NOT NULL,
  model_id TEXT,
  request_bytes INTEGER,
  response_bytes INTEGER,
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id) REFERENCES workspace_memberships(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_expires
  ON auth_sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_hash
  ON auth_sessions(session_hash);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_role
  ON workspace_memberships(workspace_id, role);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user
  ON workspace_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_provider_policies_workspace
  ON workspace_provider_policies(workspace_id);

CREATE INDEX IF NOT EXISTS idx_chat_proxy_audit_workspace_created
  ON chat_proxy_audit(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_proxy_audit_user_created
  ON chat_proxy_audit(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_proxy_audit_provider_created
  ON chat_proxy_audit(provider_id, created_at);
