import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import test from 'node:test'

import {
  assertD1DocumentParity,
  buildDirectD1DocumentStatements,
} from '../lib/seed-storage-documents-d1.mjs'

const workspaceId = 'workspace:test'
const canonicalPath = 'docs/example.md'

const schemaSql = `
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
  INSERT INTO workspaces (id) VALUES ('workspace:test');
`

const executeScenario = (scenarioSql) => {
  const querySql = `
    SELECT json_object(
      'documents', COALESCE((
        SELECT json_group_array(json_object(
          'id', id,
          'canonicalPath', canonical_path,
          'contentHash', content_hash,
          'revision', revision,
          'deleted', deleted
        )) FROM documents WHERE workspace_id = 'workspace:test'
      ), json('[]')),
      'chunks', COALESCE((
        SELECT json_group_array(json_object(
          'id', id,
          'documentId', document_id,
          'markdown', markdown
        )) FROM document_chunks
      ), json('[]'))
    ) AS result;
  `
  const result = spawnSync('sqlite3', ['-json', ':memory:'], {
    encoding: 'utf8',
    input: `${schemaSql}\n${scenarioSql}\n${querySql}`,
  })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
  const rows = JSON.parse(result.stdout)
  assert.equal(rows.length, 1)
  return JSON.parse(rows[0].result)
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
  const seed = buildSeed()
  const state = executeScenario(`
    INSERT INTO documents (
      id, workspace_id, canonical_path, title, doc_type, source_kind, content_md,
      content_hash, parser_version, revision, deleted, created_at, updated_at
    ) VALUES (
      'legacy:share-id', 'workspace:test', 'docs/example.md', 'legacy.md', 'markdown',
      'markdown', '', 'hash:legacy', 'legacy-seed', 2, 1,
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
    );
    ${buildDirectD1DocumentStatements(seed).join('\n')}
  `)

  assert.deepEqual(state.documents, [{
    id: 'legacy:share-id',
    canonicalPath,
    contentHash: 'hash:new',
    revision: 7,
    deleted: 0,
  }])
  assert.deepEqual(state.chunks, [{
    id: 'chunk:deterministic-id',
    documentId: 'legacy:share-id',
    markdown: 'new content',
  }])
})

test('direct D1 seed inserts the deterministic id for a new canonical path', () => {
  const seed = buildSeed()
  const state = executeScenario(buildDirectD1DocumentStatements(seed).join('\n'))

  assert.deepEqual(state.documents, [{
    id: seed.record.id,
    canonicalPath,
    contentHash: seed.record.contentHash,
    revision: seed.record.revision,
    deleted: 0,
  }])
  assert.equal(state.chunks[0].documentId, seed.record.id)
})

const sha256 = value => createHash('sha256').update(value).digest('hex')

const buildParitySeed = ({ canonicalPath, content, chunks = [] }) => ({
  documentMutation: {
    record: {
      canonicalPath,
      contentMd: chunks.length > 0 ? '' : content,
      contentHash: sha256(content),
      docType: 'markdown',
    },
  },
  chunkMutations: chunks.map((markdown, chunkOrder) => ({
    record: {
      id: `${canonicalPath}:chunk:${chunkOrder}`,
      chunkKey: `part-${String(chunkOrder).padStart(4, '0')}`,
      chunkOrder,
      markdown,
      contentHash: sha256(markdown),
    },
  })),
})

test('D1 seed verification requires exact active path, content, hash, and chunk parity', () => {
  const expectedDocumentSeeds = [
    buildParitySeed({ canonicalPath: 'docs/a.md', content: 'alpha' }),
    buildParitySeed({ canonicalPath: 'docs/b.md', content: 'beta-gamma', chunks: ['beta-', 'gamma'] }),
  ]
  const exportedDocuments = [
    { id: 'actual:a', canonicalPath: 'docs/a.md', contentMd: 'alpha', contentHash: sha256('alpha'), deleted: false },
    { id: 'actual:b', canonicalPath: 'docs/b.md', contentMd: '', contentHash: sha256('beta-gamma'), deleted: false },
    { id: 'actual:retired', canonicalPath: 'docs/retired.md', contentMd: '', contentHash: sha256('retired'), deleted: true },
  ]
  const exportedDocumentChunks = [
    { id: 'actual:b:0', documentId: 'actual:b', chunkKey: 'part-0000', chunkOrder: 0, markdown: 'beta-', contentHash: sha256('beta-') },
    { id: 'actual:b:1', documentId: 'actual:b', chunkKey: 'part-0001', chunkOrder: 1, markdown: 'gamma', contentHash: sha256('gamma') },
  ]

  assert.deepEqual(assertD1DocumentParity({
    expectedDocumentSeeds,
    exportedDocuments,
    exportedDocumentChunks,
  }), { documentCount: 2, chunkCount: 2 })
  assert.throws(
    () => assertD1DocumentParity({
      expectedDocumentSeeds,
      exportedDocuments: [
        exportedDocuments[0],
        { ...exportedDocuments[1], contentHash: sha256('stale') },
      ],
      exportedDocumentChunks,
    }),
    /contentHash=docs\/b\.md/,
  )
  assert.throws(
    () => assertD1DocumentParity({
      expectedDocumentSeeds,
      exportedDocuments: [
        exportedDocuments[0],
        { id: 'actual:c', canonicalPath: 'docs/c.md', contentMd: 'charlie', contentHash: sha256('charlie'), deleted: false },
      ],
      exportedDocumentChunks: [],
    }),
    /missing=docs\/b\.md; unexpected=docs\/c\.md/,
  )
})

test('D1 seed verification rejects corrupted or incomplete stored document content', () => {
  const expectedDocumentSeeds = [
    buildParitySeed({ canonicalPath: 'docs/a.md', content: 'alpha' }),
    buildParitySeed({ canonicalPath: 'docs/b.md', content: 'beta-gamma', chunks: ['beta-', 'gamma'] }),
  ]
  const exportedDocuments = [
    { id: 'actual:a', canonicalPath: 'docs/a.md', contentMd: 'corrupt', contentHash: sha256('alpha'), deleted: false },
    { id: 'actual:b', canonicalPath: 'docs/b.md', contentMd: '', contentHash: sha256('beta-gamma'), deleted: false },
  ]
  const exportedDocumentChunks = [
    { id: 'actual:b:0', documentId: 'actual:b', chunkKey: 'part-0000', chunkOrder: 0, markdown: 'beta-', contentHash: sha256('beta-') },
  ]

  assert.throws(
    () => assertD1DocumentParity({ expectedDocumentSeeds, exportedDocuments, exportedDocumentChunks }),
    /content=docs\/a\.md,docs\/b\.md; chunks=docs\/b\.md/,
  )
})

test('D1 seed verification rejects chunks retained for deleted documents', () => {
  const expectedDocumentSeeds = [buildParitySeed({ canonicalPath: 'docs/a.md', content: 'alpha' })]
  const exportedDocuments = [
    { id: 'actual:a', canonicalPath: 'docs/a.md', contentMd: 'alpha', contentHash: sha256('alpha'), deleted: false },
    { id: 'actual:retired', canonicalPath: 'docs/retired.md', contentMd: '', contentHash: sha256('retired'), deleted: true },
  ]
  const exportedDocumentChunks = [
    { id: 'stale:chunk', documentId: 'actual:retired', chunkKey: 'part-0000', chunkOrder: 0, markdown: 'retired', contentHash: sha256('retired') },
  ]

  assert.throws(
    () => assertD1DocumentParity({ expectedDocumentSeeds, exportedDocuments, exportedDocumentChunks }),
    /unexpectedChunks=stale:chunk; chunkCount=1\/0/,
  )
})
