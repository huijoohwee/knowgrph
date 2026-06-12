CREATE TABLE IF NOT EXISTS media_artifacts (
  id            TEXT PRIMARY KEY,            -- runId:stageId:shotId
  workspace_id  TEXT NOT NULL,
  run_id        TEXT NOT NULL,
  stage_id      TEXT NOT NULL,
  shot_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,              -- text | image | video
  durable_r2_url TEXT NOT NULL,             -- never ephemeral
  content_hash  TEXT NOT NULL,
  media_type    TEXT,
  provenance_json TEXT NOT NULL,
  layout_json   TEXT,
  version       INTEGER NOT NULL,           -- monotonic ownership
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_artifacts_run ON media_artifacts(workspace_id, run_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_artifacts_hash ON media_artifacts(workspace_id, content_hash);
