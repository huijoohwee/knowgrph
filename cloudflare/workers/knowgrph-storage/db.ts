import type {
  KgDocumentChunkRecord,
  KgDocumentRecord,
  KgGraphSnapshotRecord,
  KnowgrphStorageWorkerEnv,
} from './contract'

export type D1RunResult = { success?: boolean; meta?: unknown }
export type D1AllResult<T> = { results?: T[] }
export type D1StatementLike = {
  bind: (...values: unknown[]) => D1StatementLike
  run: () => Promise<D1RunResult>
  all: <T = Record<string, unknown>>() => Promise<D1AllResult<T>>
}
export type D1DatabaseLike = {
  prepare: (query: string) => D1StatementLike
}

export type DocumentRow = {
  id: string
  workspace_id: string
  canonical_path: string
  title: string | null
  doc_type: string | null
  lang: string | null
  graph_id: string | null
  source_kind: string
  content_md: string
  content_hash: string
  parser_version: string
  revision: number
  deleted: number
  updated_at: string
}

export type DocumentChunkRow = {
  id: string
  document_id: string
  workspace_id: string
  chunk_key: string
  chunk_order: number
  heading: string | null
  markdown: string
  token_estimate: number
  content_hash: string
  updated_at: string
}

export type GraphSnapshotRow = {
  id: string
  document_id: string
  workspace_id: string
  graph_revision: number
  graph_hash: string
  graph_json: string
  layout_json: string | null
  derived_from_document_revision: number
  updated_at: string
}

export const readDb = (env: KnowgrphStorageWorkerEnv): D1DatabaseLike | null => {
  const candidate = (env as Record<string, unknown>).DB
  if (!candidate || typeof candidate !== 'object') return null
  const db = candidate as Partial<D1DatabaseLike>
  return typeof db.prepare === 'function' ? (db as D1DatabaseLike) : null
}

export const normalizeString = (value: unknown): string => String(value || '').trim()

export const normalizeNullableString = (value: unknown): string | null => {
  const next = normalizeString(value)
  return next ? next : null
}

export const normalizeNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback
}

export const isoFromMs = (updatedAtMs: number, fallbackIso: string): string => {
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return fallbackIso
  try {
    return new Date(updatedAtMs).toISOString()
  } catch {
    return fallbackIso
  }
}

export const queryAll = async <T = Record<string, unknown>>(
  db: D1DatabaseLike,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> => {
  const result = await db.prepare(sql).bind(...values).all<T>()
  return Array.isArray(result.results) ? result.results : []
}

export const queryFirst = async <T = Record<string, unknown>>(
  db: D1DatabaseLike,
  sql: string,
  values: unknown[] = [],
): Promise<T | null> => {
  const rows = await queryAll<T>(db, sql, values)
  return rows[0] ?? null
}

export const execute = async (db: D1DatabaseLike, sql: string, values: unknown[] = []): Promise<void> => {
  await db.prepare(sql).bind(...values).run()
}

export const ensureWorkspaceRow = async (db: D1DatabaseLike, workspaceId: string, nowIso: string): Promise<void> => {
  await execute(
    db,
    `INSERT INTO workspaces (id, slug, title, visibility, created_at, updated_at)
     VALUES (?, ?, ?, 'private', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       updated_at = excluded.updated_at`,
    [workspaceId, workspaceId, workspaceId, nowIso, nowIso],
  )
}

export const ensureSyncDeviceRow = async (
  db: D1DatabaseLike,
  workspaceId: string,
  deviceId: string,
  nowIso: string,
): Promise<void> => {
  await execute(
    db,
    `INSERT INTO sync_devices (id, workspace_id, device_label, last_pull_cursor, last_push_cursor, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?)
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       device_label = excluded.device_label,
       updated_at = excluded.updated_at`,
    [deviceId, workspaceId, deviceId, nowIso],
  )
}

export const writeSyncEvent = async (
  db: D1DatabaseLike,
  args: { workspaceId: string; deviceId: string; eventType: string; payload: Record<string, unknown>; nowIso: string },
): Promise<void> => {
  const eventId = `${args.eventType}:${Date.now()}:${Math.random().toString(16).slice(2)}`
  await execute(
    db,
    `INSERT INTO sync_events (id, workspace_id, device_id, event_type, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [eventId, args.workspaceId, args.deviceId, args.eventType, JSON.stringify(args.payload), args.nowIso],
  )
}

export const mapDocumentRow = (row: DocumentRow): KgDocumentRecord => ({
  id: normalizeString(row.id),
  workspaceId: normalizeString(row.workspace_id),
  canonicalPath: normalizeString(row.canonical_path),
  title: normalizeNullableString(row.title),
  docType: normalizeNullableString(row.doc_type),
  lang: normalizeNullableString(row.lang),
  graphId: normalizeNullableString(row.graph_id),
  sourceKind: 'markdown',
  contentMd: typeof row.content_md === 'string' ? row.content_md : '',
  contentHash: normalizeString(row.content_hash),
  parserVersion: normalizeString(row.parser_version),
  revision: normalizeNumber(row.revision),
  updatedAtMs: Date.parse(normalizeString(row.updated_at)) || 0,
  deleted: Number(row.deleted || 0) === 1,
})

export const mapDocumentChunkRow = (row: DocumentChunkRow): KgDocumentChunkRecord => ({
  id: normalizeString(row.id),
  documentId: normalizeString(row.document_id),
  workspaceId: normalizeString(row.workspace_id),
  chunkKey: normalizeString(row.chunk_key),
  chunkOrder: normalizeNumber(row.chunk_order),
  heading: normalizeNullableString(row.heading),
  markdown: typeof row.markdown === 'string' ? row.markdown : '',
  tokenEstimate: normalizeNumber(row.token_estimate),
  contentHash: normalizeString(row.content_hash),
  updatedAtMs: Date.parse(normalizeString(row.updated_at)) || 0,
})

export const safeJsonParseObject = (text: unknown): Record<string, unknown> | null => {
  if (typeof text !== 'string' || !text.trim()) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const mapGraphSnapshotRow = (row: GraphSnapshotRow): KgGraphSnapshotRecord => ({
  id: normalizeString(row.id),
  documentId: normalizeString(row.document_id),
  workspaceId: normalizeString(row.workspace_id),
  graphRevision: normalizeNumber(row.graph_revision),
  graphHash: normalizeString(row.graph_hash),
  graphJson: safeJsonParseObject(row.graph_json) || {},
  layoutJson: safeJsonParseObject(row.layout_json),
  derivedFromDocumentRevision: normalizeNumber(row.derived_from_document_revision),
  updatedAtMs: Date.parse(normalizeString(row.updated_at)) || 0,
})
