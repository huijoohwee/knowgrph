import {
  KNOWGRPH_STORAGE_API_VERSION,
  KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
  type KnowgrphStorageErrorResponse,
  type KnowgrphStorageExportResponse,
  type KnowgrphStorageMutation,
  type KnowgrphStorageMutationAck,
  type KnowgrphStoragePullChanges,
  type KnowgrphStoragePullRequest,
  type KnowgrphStoragePullResponse,
  type KnowgrphStoragePushRequest,
  type KnowgrphStoragePushResponse,
  type KnowgrphStorageWorkerEnv,
  isKnowgrphStorageEntityKind,
} from './contract'
import {
  type D1DatabaseLike,
  type DocumentChunkRow,
  type DocumentRow,
  type GraphSnapshotRow,
  ensureSyncDeviceRow,
  ensureWorkspaceRow,
  execute,
  isoFromMs,
  mapDocumentChunkRow,
  mapDocumentRow,
  mapGraphSnapshotRow,
  normalizeNullableString,
  normalizeNumber,
  normalizeString,
  pruneStaleSyncEvents,
  queryAll,
  queryFirst,
  readDb,
  writeSyncEvent,
} from './db'
import { handleCrawlerSourceFiles, isKnowgrphStorageCrawlerRoute } from './crawler'
import {
  KNOWGRPH_STORAGE_DOC_VIEW_HEADERS as DOC_VIEW_HEADERS,
  readPublishedMarkdown,
} from '../shared/publishedDoc'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400',
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  ...CORS_HEADERS,
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

const noContent = (): Response =>
  new Response(null, { status: 204, headers: CORS_HEADERS })

const errorResponse = (
  status: number,
  code: KnowgrphStorageErrorResponse['code'],
  error: string,
): Response => {
  const body: KnowgrphStorageErrorResponse = {
    ok: false,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    error,
    code,
  }
  return json(status, body)
}

const okPushResponse = (body: Omit<KnowgrphStoragePushResponse, 'ok' | 'apiVersion'>): Response =>
  json(200, {
    ok: true,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    ...body,
  } satisfies KnowgrphStoragePushResponse)

const okPullResponse = (body: Omit<KnowgrphStoragePullResponse, 'ok' | 'apiVersion'>): Response =>
  json(200, {
    ok: true,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    ...body,
  } satisfies KnowgrphStoragePullResponse)

const okExportResponse = (body: Omit<KnowgrphStorageExportResponse, 'ok' | 'apiVersion'>): Response =>
  json(200, {
    ok: true,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    ...body,
  } satisfies KnowgrphStorageExportResponse)

const readJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const isPushRequest = (value: unknown): value is KnowgrphStoragePushRequest => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.apiVersion === KNOWGRPH_STORAGE_API_VERSION
    && typeof record.workspaceId === 'string'
    && typeof record.deviceId === 'string'
    && Array.isArray(record.mutations)
  )
}

const isPullRequest = (value: unknown): value is KnowgrphStoragePullRequest => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.apiVersion === KNOWGRPH_STORAGE_API_VERSION
    && typeof record.workspaceId === 'string'
    && typeof record.deviceId === 'string'
    && (typeof record.since === 'string' || record.since == null)
  )
}


const validateMutationWorkspace = (workspaceId: string, mutation: KnowgrphStorageMutation): string | null => {
  if (normalizeString(mutation.workspaceId) !== workspaceId) return 'mutation workspaceId does not match request workspaceId'
  const recordWorkspaceId = normalizeString((mutation.record as { workspaceId?: unknown }).workspaceId)
  if (recordWorkspaceId !== workspaceId) return 'mutation record workspaceId does not match request workspaceId'
  if (!isKnowgrphStorageEntityKind(mutation.entity)) return 'mutation entity is not supported'
  return null
}

const acknowledgeConflict = (mutation: KnowgrphStorageMutation, message: string): KnowgrphStorageMutationAck => ({
  mutationId: mutation.mutationId,
  recordId: mutation.recordId,
  entity: mutation.entity,
  status: 'conflict',
  serverRevision: null,
  message,
})

const acknowledgeRejected = (mutation: KnowgrphStorageMutation, message: string): KnowgrphStorageMutationAck => ({
  mutationId: mutation.mutationId,
  recordId: mutation.recordId,
  entity: mutation.entity,
  status: 'rejected',
  serverRevision: null,
  message,
})

const acknowledgeApplied = (
  mutation: KnowgrphStorageMutation,
  serverRevision: number | null,
): KnowgrphStorageMutationAck => ({
  mutationId: mutation.mutationId,
  recordId: mutation.recordId,
  entity: mutation.entity,
  status: 'applied',
  serverRevision,
  message: null,
})

const processDocumentMutation = async (
  db: D1DatabaseLike,
  workspaceId: string,
  mutation: Extract<KnowgrphStorageMutation, { entity: 'document' }>,
  nowIso: string,
): Promise<KnowgrphStorageMutationAck> => {
  const record = mutation.record
  const existing = await queryFirst<{ revision: number }>(
    db,
    'SELECT revision FROM documents WHERE id = ? AND workspace_id = ?',
    [record.id, workspaceId],
  )
  const existingRevision = existing ? normalizeNumber(existing.revision) : null
  if (
    mutation.baseRevision != null
    && existingRevision != null
    && existingRevision !== mutation.baseRevision
    && normalizeNumber(record.revision) <= existingRevision
  ) {
    return acknowledgeConflict(mutation, `document revision conflict: expected ${mutation.baseRevision}, found ${existingRevision}`)
  }
  await execute(
    db,
    `INSERT INTO documents (
       id, workspace_id, canonical_path, title, doc_type, lang, graph_id, source_kind,
       content_md, content_hash, parser_version, revision, deleted, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       updated_at = excluded.updated_at`,
    [
      record.id,
      workspaceId,
      record.canonicalPath,
      record.title,
      record.docType,
      record.lang,
      record.graphId,
      record.sourceKind,
      record.contentMd,
      record.contentHash,
      record.parserVersion,
      normalizeNumber(record.revision),
      record.deleted || mutation.op === 'delete' ? 1 : 0,
      isoFromMs(record.updatedAtMs, nowIso),
      isoFromMs(record.updatedAtMs, nowIso),
    ],
  )
  return acknowledgeApplied(mutation, normalizeNumber(record.revision))
}

const processDocumentChunkMutation = async (
  db: D1DatabaseLike,
  workspaceId: string,
  mutation: Extract<KnowgrphStorageMutation, { entity: 'documentChunk' }>,
  nowIso: string,
): Promise<KnowgrphStorageMutationAck> => {
  const record = mutation.record
  if (mutation.op === 'delete') {
    await execute(db, 'DELETE FROM document_chunks WHERE id = ? AND workspace_id = ?', [record.id, workspaceId])
    return acknowledgeApplied(mutation, null)
  }
  await execute(
    db,
    `INSERT INTO document_chunks (
       id, document_id, workspace_id, chunk_key, chunk_order, heading, markdown, token_estimate, content_hash, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       document_id = excluded.document_id,
       workspace_id = excluded.workspace_id,
       chunk_key = excluded.chunk_key,
       chunk_order = excluded.chunk_order,
       heading = excluded.heading,
       markdown = excluded.markdown,
       token_estimate = excluded.token_estimate,
       content_hash = excluded.content_hash,
       updated_at = excluded.updated_at`,
    [
      record.id,
      record.documentId,
      workspaceId,
      record.chunkKey,
      normalizeNumber(record.chunkOrder),
      record.heading,
      record.markdown,
      normalizeNumber(record.tokenEstimate),
      record.contentHash,
      isoFromMs(record.updatedAtMs, nowIso),
    ],
  )
  return acknowledgeApplied(mutation, null)
}

const processGraphSnapshotMutation = async (
  db: D1DatabaseLike,
  workspaceId: string,
  mutation: Extract<KnowgrphStorageMutation, { entity: 'graphSnapshot' }>,
  nowIso: string,
): Promise<KnowgrphStorageMutationAck> => {
  const record = mutation.record
  if (mutation.op === 'delete') {
    await execute(db, 'DELETE FROM graph_snapshots WHERE id = ? AND workspace_id = ?', [record.id, workspaceId])
    return acknowledgeApplied(mutation, null)
  }
  const existing = await queryFirst<{ graph_revision: number }>(
    db,
    'SELECT MAX(graph_revision) AS graph_revision FROM graph_snapshots WHERE document_id = ? AND workspace_id = ?',
    [record.documentId, workspaceId],
  )
  const existingRevision = existing?.graph_revision == null ? null : normalizeNumber(existing.graph_revision)
  if (
    mutation.baseRevision != null
    && existingRevision != null
    && existingRevision !== mutation.baseRevision
    && normalizeNumber(record.graphRevision) <= existingRevision
  ) {
    return acknowledgeConflict(mutation, `graph snapshot revision conflict: expected ${mutation.baseRevision}, found ${existingRevision}`)
  }
  await execute(
    db,
    `INSERT INTO graph_snapshots (
       id, document_id, workspace_id, graph_revision, graph_hash, graph_json, layout_json, derived_from_document_revision, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       document_id = excluded.document_id,
       workspace_id = excluded.workspace_id,
       graph_revision = excluded.graph_revision,
       graph_hash = excluded.graph_hash,
       graph_json = excluded.graph_json,
       layout_json = excluded.layout_json,
       derived_from_document_revision = excluded.derived_from_document_revision,
       updated_at = excluded.updated_at`,
    [
      record.id,
      record.documentId,
      workspaceId,
      normalizeNumber(record.graphRevision),
      record.graphHash,
      JSON.stringify(record.graphJson || {}),
      record.layoutJson == null ? null : JSON.stringify(record.layoutJson),
      normalizeNumber(record.derivedFromDocumentRevision),
      isoFromMs(record.updatedAtMs, nowIso),
    ],
  )
  return acknowledgeApplied(mutation, normalizeNumber(record.graphRevision))
}

const handlePush = async (request: Request, env: KnowgrphStorageWorkerEnv, db: D1DatabaseLike): Promise<Response> => {
  const body = await readJsonBody(request)
  if (!isPushRequest(body)) return errorResponse(400, 'bad_request', 'invalid storage push request')
  const workspaceId = normalizeString(body.workspaceId)
  const deviceId = normalizeString(body.deviceId)
  if (!workspaceId || !deviceId) return errorResponse(400, 'bad_request', 'workspaceId and deviceId are required')
  const nowIso = new Date().toISOString()
  const serverTimeMs = Date.parse(nowIso)
  await ensureWorkspaceRow(db, workspaceId, nowIso)
  await ensureSyncDeviceRow(db, workspaceId, deviceId, nowIso)
  const acknowledgements: KnowgrphStorageMutationAck[] = []
  for (const mutation of body.mutations) {
    const mismatch = validateMutationWorkspace(workspaceId, mutation)
    if (mismatch) {
      acknowledgements.push(acknowledgeRejected(mutation, mismatch))
      continue
    }
    if (mutation.entity === 'document') {
      acknowledgements.push(await processDocumentMutation(db, workspaceId, mutation, nowIso))
      continue
    }
    if (mutation.entity === 'documentChunk') {
      acknowledgements.push(await processDocumentChunkMutation(db, workspaceId, mutation, nowIso))
      continue
    }
    if (mutation.entity === 'graphSnapshot') {
      acknowledgements.push(await processGraphSnapshotMutation(db, workspaceId, mutation, nowIso))
      continue
    }
    acknowledgements.push(acknowledgeRejected(mutation, 'unsupported mutation entity'))
  }
  await execute(
    db,
    'UPDATE sync_devices SET last_push_cursor = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
    [nowIso, nowIso, deviceId, workspaceId],
  )
  await writeSyncEvent(db, {
    workspaceId,
    deviceId,
    eventType: 'push',
    payload: { mutationCount: body.mutations.length, acknowledgements },
    nowIso,
  })
  await pruneStaleSyncEvents(db, nowIso)
  return okPushResponse({
    workspaceId,
    ackCursor: nowIso,
    serverTimeMs,
    acknowledgements,
  })
}

const readPullChanges = async (db: D1DatabaseLike, workspaceId: string, since: string | null): Promise<KnowgrphStoragePullChanges> => {
  const sinceValue = normalizeNullableString(since)
  const documentSql = sinceValue
    ? 'SELECT * FROM documents WHERE workspace_id = ? AND updated_at > ? ORDER BY updated_at ASC'
    : 'SELECT * FROM documents WHERE workspace_id = ? ORDER BY updated_at ASC'
  const documentChunkSql = sinceValue
    ? 'SELECT * FROM document_chunks WHERE workspace_id = ? AND updated_at > ? ORDER BY updated_at ASC'
    : 'SELECT * FROM document_chunks WHERE workspace_id = ? ORDER BY updated_at ASC'
  const graphSnapshotSql = sinceValue
    ? 'SELECT * FROM graph_snapshots WHERE workspace_id = ? AND updated_at > ? ORDER BY updated_at ASC'
    : 'SELECT * FROM graph_snapshots WHERE workspace_id = ? ORDER BY updated_at ASC'
  const args = sinceValue ? [workspaceId, sinceValue] : [workspaceId]
  const [documents, documentChunks, graphSnapshots] = await Promise.all([
    queryAll<DocumentRow>(db, documentSql, args),
    queryAll<DocumentChunkRow>(db, documentChunkSql, args),
    queryAll<GraphSnapshotRow>(db, graphSnapshotSql, args),
  ])
  return {
    documents: documents.map(mapDocumentRow),
    documentChunks: documentChunks.map(mapDocumentChunkRow),
    graphSnapshots: graphSnapshots.map(mapGraphSnapshotRow),
  }
}

const handlePull = async (request: Request, env: KnowgrphStorageWorkerEnv, db: D1DatabaseLike): Promise<Response> => {
  const body = await readJsonBody(request)
  const pullRequest = isPullRequest(body) ? body : null
  if (!pullRequest) return errorResponse(400, 'bad_request', 'invalid storage pull request')
  const workspaceId = normalizeString(pullRequest.workspaceId)
  const deviceId = normalizeString(pullRequest.deviceId)
  if (!workspaceId || !deviceId) return errorResponse(400, 'bad_request', 'workspaceId and deviceId are required')
  const nowIso = new Date().toISOString()
  const serverTimeMs = Date.parse(nowIso)
  await ensureWorkspaceRow(db, workspaceId, nowIso)
  await ensureSyncDeviceRow(db, workspaceId, deviceId, nowIso)
  const changes = await readPullChanges(db, workspaceId, pullRequest.since)
  const hasChanges =
    changes.documents.length > 0
    || changes.documentChunks.length > 0
    || changes.graphSnapshots.length > 0
  if (hasChanges) {
    await execute(
      db,
      'UPDATE sync_devices SET last_pull_cursor = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
      [nowIso, nowIso, deviceId, workspaceId],
    )
  }
  return okPullResponse({
    workspaceId,
    nextCursor: nowIso,
    serverTimeMs,
    changes,
  })
}

const handleExport = async (request: Request, env: KnowgrphStorageWorkerEnv, db: D1DatabaseLike): Promise<Response> => {
  const url = new URL(request.url)
  const pathname = url.pathname
  const encodedWorkspaceId = pathname.slice(KNOWGRPH_STORAGE_ROUTE_PATHS.exportPrefix.length)
  const workspaceId = normalizeString(decodeURIComponent(encodedWorkspaceId || ''))
  if (!workspaceId) return errorResponse(400, 'bad_request', 'workspaceId is required')
  const nowIso = new Date().toISOString()
  await ensureWorkspaceRow(db, workspaceId, nowIso)
  const changes = await readPullChanges(db, workspaceId, null)
  return okExportResponse({
    workspaceId,
    exportedAtMs: Date.parse(nowIso),
    documents: changes.documents,
    documentChunks: changes.documentChunks,
    graphSnapshots: changes.graphSnapshots,
  })
}

const DOC_VIEW_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'cache-control': 'public, max-age=60, must-revalidate',
  ...CORS_HEADERS,
}

const readDocRouteSegments = (
  pathname: string,
  prefix: string,
): { workspaceId: string; canonicalPath: string } | null => {
  const suffix = pathname.slice(prefix.length)
  if (!suffix) return null
  const firstSlash = suffix.indexOf('/')
  if (firstSlash < 1) return null
  const workspaceId = normalizeString(decodeURIComponent(suffix.slice(0, firstSlash)))
  const canonicalPath = normalizeString(decodeURIComponent(suffix.slice(firstSlash + 1)))
  if (!workspaceId || !canonicalPath) return null
  return { workspaceId, canonicalPath }
}

const readDefaultDocRouteSegments = (
  pathname: string,
  prefix: string,
): { workspaceId: string; canonicalPath: string } | null => {
  const suffix = pathname.slice(prefix.length)
  const canonicalPath = normalizeString(decodeURIComponent(suffix || ''))
  if (!canonicalPath) return null
  return {
    workspaceId: KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
    canonicalPath,
  }
}

const handleDocView = async (request: Request, _env: KnowgrphStorageWorkerEnv, db: D1DatabaseLike): Promise<Response> => {
  const pathname = new URL(request.url).pathname
  const route = readDocRouteSegments(pathname, KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix)
  if (!route) return errorResponse(400, 'bad_request', 'workspaceId and canonicalPath are required')
  const contentMd = await readPublishedMarkdown(db, { workspaceId: route.workspaceId, canonicalPath: route.canonicalPath })
  if (contentMd === null) return errorResponse(404, 'not_found', 'document not found')
  return new Response(contentMd, { status: 200, headers: DOC_VIEW_HEADERS })
}

const handleDefaultDocView = async (request: Request, _env: KnowgrphStorageWorkerEnv, db: D1DatabaseLike): Promise<Response> => {
  const pathname = new URL(request.url).pathname
  const route = readDefaultDocRouteSegments(pathname, KNOWGRPH_STORAGE_ROUTE_PATHS.defaultDocPrefix)
  if (!route) return errorResponse(400, 'bad_request', 'canonicalPath is required')
  const contentMd = await readPublishedMarkdown(db, { workspaceId: route.workspaceId, canonicalPath: route.canonicalPath })
  if (contentMd === null) return errorResponse(404, 'not_found', 'document not found')
  return new Response(contentMd, { status: 200, headers: DOC_VIEW_HEADERS })
}

export const createKnowgrphStorageWorker = () => ({
  async fetch(request: Request, env: KnowgrphStorageWorkerEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return noContent()
    }
    const db = readDb(env)
    if (!db) return errorResponse(500, 'server_error', 'missing Cloudflare D1 binding DB')
    const url = new URL(request.url)
    try {
      if (request.method === 'POST' && url.pathname === KNOWGRPH_STORAGE_ROUTE_PATHS.push) {
        return await handlePush(request, env, db)
      }
      if (request.method === 'POST' && url.pathname === KNOWGRPH_STORAGE_ROUTE_PATHS.pull) {
        return await handlePull(request, env, db)
      }
      if (request.method === 'GET' && url.pathname.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.exportPrefix)) {
        return await handleExport(request, env, db)
      }
      if (request.method === 'GET' && url.pathname.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.defaultDocPrefix)) {
        return await handleDefaultDocView(request, env, db)
      }
      if (request.method === 'GET' && url.pathname.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix)) {
        return await handleDocView(request, env, db)
      }
      if (request.method === 'GET' && isKnowgrphStorageCrawlerRoute(url.pathname)) {
        const crawlerResponse = await handleCrawlerSourceFiles(request, db, CORS_HEADERS)
        if (crawlerResponse) return crawlerResponse
      }
      return errorResponse(404, 'not_found', 'storage route not found')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unexpected worker error'
      return errorResponse(500, 'server_error', message)
    }
  },
})

const worker = createKnowgrphStorageWorker()

export default worker
