import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import { buildDirectD1DocumentStatements } from '../lib/seed-storage-documents-d1.mjs'

const workspaceId = 'workspace:test'
const canonicalPath = 'docs/example.md'

const createDatabase = () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE workspaces (id TEXT PRIMARY KEY);
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      canonical_path TEXT NOT NULL,
      title TEXT,
      doc_type TEXT,
      lang TEXT,
      graph_id TEXT,
      source_kind TEXT NOT NULL,
      content_md TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      parser_version TEXT NOT NULL,
      revision INTEGER NOT NULL,
      deleted INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      UNIQUE (workspace_id, canonical_path)
    );
    CREATE TABLE document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      chunk_key TEXT NOT NULL,
      chunk_order INTEGER NOT NULL,
      heading TEXT,
      markdown TEXT NOT NULL,
      token_estimate INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      UNIQUE (document_id, chunk_key)
    );
  `)
  db.prepare('INSERT INTO workspaces (id) VALUES (?)').run(workspaceId)
  return db
}

const buildSeed = () => ({
  record: {
    id: 'docs:deterministic-id',
    workspaceId,
    canonicalPath,
    title: 'example.md',
    docType: 'markdown',
    lang: null,
    graphId: 'graph:example',
    sourceKind: 'markdown',
    contentMd: '',
    contentHash: 'hash:new',
    parserVersion: 'seed:test',
    revision: 7,
    updatedAtMs: 1_700_000_000_000,
    deleted: false,
  },
  chunkMutations: [{
    entity: 'documentChunk',
    op: 'upsert',
    record: {
      id: 'chunk:deterministic-id',
      documentId: 'docs:deterministic-id',
      workspaceId,
      chunkKey: 'part-0000',
      chunkOrder: 0,
      heading: null,
      markdown: 'new content',
      tokenEstimate: 3,
      contentHash: 'chunk-hash:new',
      updatedAtMs: 1_700_000_000_000,
    },
  }],
})

test('direct D1 seed reuses the row that already owns a canonical path', () => {
  const db = createDatabase()
  db.prepare(`
    INSERT INTO documents (
      id, workspace_id, canonical_path, title, doc_type, source_kind, content_md,
      content_hash, parser_version, revision, deleted, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'legacy:share-id', workspaceId, canonicalPath, 'legacy.md', 'markdown', 'markdown', '',
    'hash:legacy', 'legacy-seed', 2, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
  )

  const seed = buildSeed()
  db.exec(buildDirectD1DocumentStatements(seed).join('\n'))

  const documents = db.prepare(`
    SELECT id, canonical_path, content_hash, revision, deleted
    FROM documents WHERE workspace_id = ?
  `).all(workspaceId).map((row) => ({ ...row }))
  assert.deepEqual(documents, [{
    id: 'legacy:share-id',
    canonical_path: canonicalPath,
    content_hash: 'hash:new',
    revision: 7,
    deleted: 0,
  }])
  assert.deepEqual(
    db.prepare('SELECT id, document_id, markdown FROM document_chunks').all().map((row) => ({ ...row })),
    [{ id: 'chunk:deterministic-id', document_id: 'legacy:share-id', markdown: 'new content' }],
  )
})

test('direct D1 seed inserts the deterministic id for a new canonical path', () => {
  const db = createDatabase()
  const seed = buildSeed()
  db.exec(buildDirectD1DocumentStatements(seed).join('\n'))

  assert.deepEqual(
    db.prepare('SELECT id, canonical_path FROM documents').all().map((row) => ({ ...row })),
    [{ id: seed.record.id, canonical_path: canonicalPath }],
  )
  assert.equal(
    db.prepare('SELECT document_id FROM document_chunks').get().document_id,
    seed.record.id,
  )
})
