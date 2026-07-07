PRAGMA foreign_keys = ON;
INSERT INTO documents (
  id, workspace_id, canonical_path, title, doc_type, lang, graph_id, source_kind,
  content_md, content_hash, parser_version, revision, deleted, created_at, updated_at
) VALUES (
  'docs:41f0897976528657435071bf',
  'kgws:canonical-docs',
  'huijoohwee/docs/selection-match-smoke.md',
  'selection-match-smoke.md',
  'markdown',
  NULL,
  'docs-graph:41f0897976528657435071bf',
  'markdown',
  '# Selection Smoke

Semantic highlight alpha anchors should repeat naturally across this viewer. The alpha token appears near the start, and another alpha token appears later so a selection can highlight the peer text.

Organic marker geometry keeps the overlay slightly uneven instead of boxed. The alpha word should still line up with the peer text and avoid offset drift.
',
  '73655eb0b68735943844ead61a4460ec2d93fb0882b268507aef6319c81f6cc3',
  'seed-storage-docs-to-cloudflare:v1',
  1782951080685,
  0,
  '2026-07-02T00:11:20.685Z',
  '2026-07-02T00:11:20.685Z'
)
ON CONFLICT(id) DO UPDATE SET
  workspace_id = excluded.workspace_id,
  canonical_path = excluded.canonical_path,
  title = excluded.title,
  doc_type = excluded.doc_type,
  lang = excluded.lang,
  graph_id = excluded.graph_id,
  source_kind = excluded.source_kind,
  content_md = excluded.content_md,
  content_hash = excluded.content_hash,
  parser_version = excluded.parser_version,
  revision = excluded.revision,
  deleted = excluded.deleted,
  updated_at = excluded.updated_at;
DELETE FROM document_chunks WHERE document_id = 'docs:41f0897976528657435071bf' AND workspace_id = 'kgws:canonical-docs';