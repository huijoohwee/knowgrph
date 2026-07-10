ALTER TABLE strytree_assets
RENAME TO strytree_assets_legacy_0005;

CREATE TABLE strytree_assets (
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

INSERT INTO strytree_assets
SELECT * FROM strytree_assets_legacy_0005;

DROP TABLE strytree_assets_legacy_0005;

CREATE INDEX IF NOT EXISTS idx_strytree_assets_story_owner
  ON strytree_assets(story_id, owner_node_id);
