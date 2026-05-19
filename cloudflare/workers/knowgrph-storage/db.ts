import type {
  KgDocumentChunkRecord,
  KgDocumentRecord,
  KgGraphSnapshotRecord,
} from './contract'
import {
  execute,
  isoFromMs,
  normalizeNullableString,
  normalizeNumber,
  normalizeString,
  queryFirst,
} from '../shared/d1'
import type { D1DatabaseLike } from '../shared/d1'

export {
  execute,
  isoFromMs,
  normalizeNullableString,
  normalizeNumber,
  normalizeString,
  queryAll,
  queryFirst,
  readDb,
} from '../shared/d1'
export type {
  D1AllResult,
  D1DatabaseLike,
  D1RunResult,
  D1StatementLike,
} from '../shared/d1'

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

export const ensureWorkspaceRow = async (db: D1DatabaseLike, workspaceId: string, nowIso: string): Promise<void> => {
  const existing = await queryFirst<{ id: string }>(db, 'SELECT id FROM workspaces WHERE id = ?', [workspaceId])
  if (existing) return
  await execute(
    db,
    `INSERT INTO workspaces (id, slug, title, visibility, created_at, updated_at)
     VALUES (?, ?, ?, 'private', ?, ?)`,
    [workspaceId, workspaceId, workspaceId, nowIso, nowIso],
  )
}

export const ensureSyncDeviceRow = async (
  db: D1DatabaseLike,
  workspaceId: string,
  deviceId: string,
  nowIso: string,
): Promise<void> => {
  const existing = await queryFirst<{ id: string }>(db, 'SELECT id FROM sync_devices WHERE id = ?', [deviceId])
  if (existing) return
  await execute(
    db,
    `INSERT INTO sync_devices (id, workspace_id, device_label, last_pull_cursor, last_push_cursor, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?)`,
    [deviceId, workspaceId, deviceId, nowIso],
  )
}

const SYNC_EVENT_RETENTION_HOURS = 24

export const pruneStaleSyncEvents = async (db: D1DatabaseLike, nowIso: string): Promise<void> => {
  const cutoff = new Date(Date.parse(nowIso) - SYNC_EVENT_RETENTION_HOURS * 3600_000).toISOString()
  await execute(db, 'DELETE FROM sync_events WHERE created_at < ?', [cutoff])
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
