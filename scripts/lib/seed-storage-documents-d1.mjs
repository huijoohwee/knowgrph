import { createHash } from 'node:crypto'

export const toSqlString = (value) => `'${String(value || '').replace(/'/g, "''")}'`

export const toSqlNullableString = (value) => {
  if (value == null) return 'NULL'
  return toSqlString(value)
}

const toIsoTimestamp = (value) => new Date(Math.max(1, Number(value || Date.now()))).toISOString()

export const buildDirectD1DocumentStatements = ({ record, chunkMutations }) => {
  const updatedAtIso = toIsoTimestamp(record.updatedAtMs)
  const documentIdentitySql = [
    'SELECT id FROM documents',
    `WHERE workspace_id = ${toSqlString(record.workspaceId)}`,
    `  AND canonical_path = ${toSqlString(record.canonicalPath)}`,
    'LIMIT 1',
  ].join('\n')
  const statements = [
    'PRAGMA foreign_keys = ON;',
    `INSERT INTO documents (`,
    `  id, workspace_id, canonical_path, title, doc_type, lang, graph_id, source_kind,`,
    `  content_md, content_hash, parser_version, revision, deleted, created_at, updated_at`,
    `) VALUES (`,
    `  ${toSqlString(record.id)},`,
    `  ${toSqlString(record.workspaceId)},`,
    `  ${toSqlString(record.canonicalPath)},`,
    `  ${toSqlNullableString(record.title)},`,
    `  ${toSqlNullableString(record.docType)},`,
    `  ${toSqlNullableString(record.lang)},`,
    `  ${toSqlNullableString(record.graphId)},`,
    `  ${toSqlString(record.sourceKind)},`,
    `  ${toSqlString(record.contentMd)},`,
    `  ${toSqlString(record.contentHash)},`,
    `  ${toSqlString(record.parserVersion)},`,
    `  ${Math.max(1, Number(record.revision || 1))},`,
    `  ${record.deleted ? 1 : 0},`,
    `  ${toSqlString(updatedAtIso)},`,
    `  ${toSqlString(updatedAtIso)}`,
    `)`,
    `ON CONFLICT(workspace_id, canonical_path) DO UPDATE SET`,
    `  title = excluded.title,`,
    `  doc_type = excluded.doc_type,`,
    `  lang = excluded.lang,`,
    `  graph_id = excluded.graph_id,`,
    `  source_kind = excluded.source_kind,`,
    `  content_md = excluded.content_md,`,
    `  content_hash = excluded.content_hash,`,
    `  parser_version = excluded.parser_version,`,
    `  revision = excluded.revision,`,
    `  deleted = excluded.deleted,`,
    `  updated_at = excluded.updated_at;`,
    `DELETE FROM document_chunks`,
    `WHERE workspace_id = ${toSqlString(record.workspaceId)}`,
    `  AND document_id = (${documentIdentitySql});`,
  ]
  for (const chunkMutation of chunkMutations) {
    if (!chunkMutation || chunkMutation.entity !== 'documentChunk' || chunkMutation.op !== 'upsert') continue
    const chunk = chunkMutation.record
    const chunkUpdatedAtIso = toIsoTimestamp(chunk.updatedAtMs)
    statements.push(
      [
        `INSERT INTO document_chunks (`,
        `  id, document_id, workspace_id, chunk_key, chunk_order, heading, markdown, token_estimate, content_hash, updated_at`,
        `) VALUES (`,
        `  ${toSqlString(chunk.id)},`,
        `  (${documentIdentitySql}),`,
        `  ${toSqlString(chunk.workspaceId)},`,
        `  ${toSqlString(chunk.chunkKey)},`,
        `  ${Math.max(0, Number(chunk.chunkOrder || 0))},`,
        `  ${toSqlNullableString(chunk.heading)},`,
        `  ${toSqlString(chunk.markdown)},`,
        `  ${Math.max(1, Number(chunk.tokenEstimate || 1))},`,
        `  ${toSqlString(chunk.contentHash)},`,
        `  ${toSqlString(chunkUpdatedAtIso)}`,
        `)`,
        `ON CONFLICT(id) DO UPDATE SET`,
        `  document_id = excluded.document_id,`,
        `  workspace_id = excluded.workspace_id,`,
        `  chunk_key = excluded.chunk_key,`,
        `  chunk_order = excluded.chunk_order,`,
        `  heading = excluded.heading,`,
        `  markdown = excluded.markdown,`,
        `  token_estimate = excluded.token_estimate,`,
        `  content_hash = excluded.content_hash,`,
        `  updated_at = excluded.updated_at;`,
      ].join('\n'),
    )
  }
  return statements
}

const normalizeString = (value) => String(value || '').trim()

const sha256Content = (content, docType = 'markdown') => {
  const value = String(content || '')
  const bytes = normalizeString(docType).toLowerCase() === 'glb'
    ? Buffer.from(value, 'base64')
    : value
  return createHash('sha256').update(bytes).digest('hex')
}

const sortedChunks = (chunks) => [...(chunks || [])].sort((left, right) => (
  Number(left?.chunkOrder || 0) - Number(right?.chunkOrder || 0)
  || normalizeString(left?.chunkKey).localeCompare(normalizeString(right?.chunkKey))
  || normalizeString(left?.id).localeCompare(normalizeString(right?.id))
))

const duplicateValues = (values) => {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

export const assertD1DocumentParity = ({
  expectedDocumentSeeds,
  exportedDocuments,
  exportedDocumentChunks,
}) => {
  const expectedEntries = (expectedDocumentSeeds || []).map(seed => ({
    record: seed?.documentMutation?.record,
    chunks: sortedChunks((seed?.chunkMutations || []).map(mutation => mutation?.record).filter(Boolean)),
  }))
  const invalidExpected = expectedEntries.filter(entry => !normalizeString(entry.record?.canonicalPath))
  const expectedPaths = expectedEntries.map(entry => normalizeString(entry.record?.canonicalPath)).filter(Boolean)
  const duplicateExpected = duplicateValues(expectedPaths)
  const expectedByPath = new Map(expectedEntries.map(entry => [
    normalizeString(entry.record?.canonicalPath),
    entry,
  ]).filter(([canonicalPath]) => canonicalPath))
  const activeDocuments = (exportedDocuments || []).filter(document => (
    document
    && document.deleted !== true
    && Number(document.deleted || 0) !== 1
  ))
  const actualPaths = activeDocuments.map(document => normalizeString(document?.canonicalPath)).filter(Boolean)
  const duplicateActual = duplicateValues(actualPaths)
  const actualByPath = new Map(activeDocuments.map(document => [
    normalizeString(document?.canonicalPath),
    document,
  ]).filter(([canonicalPath]) => canonicalPath))
  const missing = [...expectedByPath.keys()].filter(canonicalPath => !actualByPath.has(canonicalPath))
  const unexpected = [...actualByPath.keys()].filter(canonicalPath => !expectedByPath.has(canonicalPath))
  const exportedChunks = (exportedDocumentChunks || []).filter(Boolean)
  const chunksByDocumentId = new Map()
  for (const chunk of exportedChunks) {
    const documentId = normalizeString(chunk?.documentId)
    const chunks = chunksByDocumentId.get(documentId) || []
    chunks.push(chunk)
    chunksByDocumentId.set(documentId, chunks)
  }

  const expectedActiveDocumentIds = new Set()
  const documentHashMismatches = new Set()
  const contentMismatches = new Set()
  const chunkMismatches = new Set()
  const invalidExpectedHashes = new Set()
  let expectedChunkCount = 0

  for (const [canonicalPath, expected] of expectedByPath) {
    const actual = actualByPath.get(canonicalPath)
    expectedChunkCount += expected.chunks.length
    if (!actual) continue
    const actualDocumentId = normalizeString(actual.id)
    expectedActiveDocumentIds.add(actualDocumentId)
    const actualChunks = sortedChunks(chunksByDocumentId.get(actualDocumentId) || [])
    const expectedContent = expected.chunks.length > 0
      ? expected.chunks.map(chunk => String(chunk.markdown || '')).join('')
      : String(expected.record?.contentMd || '')
    const actualContent = actualChunks.length > 0
      ? actualChunks.map(chunk => String(chunk.markdown || '')).join('')
      : String(actual.contentMd || '')
    const expectedHash = normalizeString(expected.record?.contentHash)

    if (sha256Content(expectedContent, expected.record?.docType) !== expectedHash) {
      invalidExpectedHashes.add(canonicalPath)
    }
    if (normalizeString(actual.contentHash) !== expectedHash) {
      documentHashMismatches.add(canonicalPath)
    }
    if (
      actualContent !== expectedContent
      || String(actual.contentMd || '') !== String(expected.record?.contentMd || '')
      || sha256Content(actualContent, expected.record?.docType) !== expectedHash
    ) {
      contentMismatches.add(canonicalPath)
    }
    if (actualChunks.length !== expected.chunks.length) {
      chunkMismatches.add(canonicalPath)
    }
    for (let index = 0; index < Math.min(actualChunks.length, expected.chunks.length); index += 1) {
      const actualChunk = actualChunks[index]
      const expectedChunk = expected.chunks[index]
      const actualMarkdown = String(actualChunk?.markdown || '')
      const expectedMarkdown = String(expectedChunk?.markdown || '')
      const expectedChunkHash = normalizeString(expectedChunk?.contentHash)
      if (
        normalizeString(actualChunk?.chunkKey) !== normalizeString(expectedChunk?.chunkKey)
        || Number(actualChunk?.chunkOrder || 0) !== Number(expectedChunk?.chunkOrder || 0)
        || actualMarkdown !== expectedMarkdown
        || normalizeString(actualChunk?.contentHash) !== expectedChunkHash
        || sha256Content(actualMarkdown) !== expectedChunkHash
        || sha256Content(expectedMarkdown) !== expectedChunkHash
      ) {
        chunkMismatches.add(canonicalPath)
      }
    }
  }

  const unexpectedChunks = exportedChunks
    .filter(chunk => !expectedActiveDocumentIds.has(normalizeString(chunk?.documentId)))
    .map(chunk => normalizeString(chunk?.id) || normalizeString(chunk?.documentId) || 'unknown')
    .sort()
  const failures = [
    invalidExpected.length > 0 ? `invalidExpected=${invalidExpected.length}` : '',
    duplicateExpected.length > 0 ? `duplicateExpected=${duplicateExpected.join(',')}` : '',
    duplicateActual.length > 0 ? `duplicateActual=${duplicateActual.join(',')}` : '',
    missing.length > 0 ? `missing=${missing.join(',')}` : '',
    unexpected.length > 0 ? `unexpected=${unexpected.join(',')}` : '',
    documentHashMismatches.size > 0 ? `contentHash=${[...documentHashMismatches].sort().join(',')}` : '',
    contentMismatches.size > 0 ? `content=${[...contentMismatches].sort().join(',')}` : '',
    chunkMismatches.size > 0 ? `chunks=${[...chunkMismatches].sort().join(',')}` : '',
    invalidExpectedHashes.size > 0 ? `invalidExpectedHash=${[...invalidExpectedHashes].sort().join(',')}` : '',
    unexpectedChunks.length > 0 ? `unexpectedChunks=${unexpectedChunks.join(',')}` : '',
    activeDocuments.length !== expectedByPath.size
      ? `documentCount=${activeDocuments.length}/${expectedByPath.size}`
      : '',
    exportedChunks.length !== expectedChunkCount
      ? `chunkCount=${exportedChunks.length}/${expectedChunkCount}`
      : '',
  ].filter(Boolean)
  if (failures.length > 0) throw new Error(failures.join('; '))
  return {
    documentCount: activeDocuments.length,
    chunkCount: exportedChunks.length,
  }
}
