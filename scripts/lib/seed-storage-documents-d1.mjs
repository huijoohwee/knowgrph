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
