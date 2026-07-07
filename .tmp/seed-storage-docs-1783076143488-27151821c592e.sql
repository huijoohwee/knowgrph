PRAGMA foreign_keys = ON;
INSERT INTO documents (
  id, workspace_id, canonical_path, title, doc_type, lang, graph_id, source_kind,
  content_md, content_hash, parser_version, revision, deleted, created_at, updated_at
) VALUES (
  'docs:cef8ffb15621f7552a37707a',
  'kgws:canonical-docs',
  'huijoohwee/docs/knowgrph-vdeoxpln-demo-html-video-renderer-widget-video-output.md',
  'knowgrph-vdeoxpln-demo-html-video-renderer-widget-video-output.md',
  'markdown',
  NULL,
  'docs-graph:cef8ffb15621f7552a37707a',
  'markdown',
  '# HTML Video Renderer Widget Video Output

| key | value |
| --- | --- |
| kind | video |
| artifactPath | ./knowgrph-vdeoxpln-demo-html-video-renderer-widget.mp4 |
| mimeType | video/mp4; codecs="avc1.42e01e" |
| model | canvas-2d |
| engineId | canvas-2d |
| renderJobId | 0f79237f |
| durationMs | 6000 |
| fps | 24 |
| width | 1280 |
| height | 720 |

<video controls src="./knowgrph-vdeoxpln-demo-html-video-renderer-widget.mp4"></video>',
  '958ebb235d31f2931f7cbc869f44f9c3bf948f83a8c19c61e177ef7f51fb162a',
  'seed-storage-docs-to-cloudflare:v1',
  1782951080681,
  0,
  '2026-07-02T00:11:20.681Z',
  '2026-07-02T00:11:20.681Z'
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
DELETE FROM document_chunks WHERE document_id = 'docs:cef8ffb15621f7552a37707a' AND workspace_id = 'kgws:canonical-docs';