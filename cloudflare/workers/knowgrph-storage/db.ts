import { and, asc, eq, gt, lt, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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
  queryAll,
  queryFirst,
  readDb,
} from '../shared/d1'
import type {
  D1AllResult,
  D1DatabaseLike,
  D1RunResult,
  D1StatementLike,
} from '../shared/d1'

export {
  execute,
  isoFromMs,
  normalizeNullableString,
  normalizeNumber,
  normalizeString,
  queryAll,
  queryFirst,
  readDb,
}
export type {
  D1AllResult,
  D1DatabaseLike,
  D1RunResult,
  D1StatementLike,
}

const workspacesTable = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  visibility: text('visibility').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

const documentsTable = sqliteTable('documents', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  canonical_path: text('canonical_path').notNull(),
  title: text('title'),
  doc_type: text('doc_type'),
  lang: text('lang'),
  graph_id: text('graph_id'),
  source_kind: text('source_kind').notNull(),
  content_md: text('content_md').notNull(),
  content_hash: text('content_hash').notNull(),
  parser_version: text('parser_version').notNull(),
  revision: integer('revision').notNull(),
  deleted: integer('deleted').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

const documentChunksTable = sqliteTable('document_chunks', {
  id: text('id').primaryKey(),
  document_id: text('document_id').notNull(),
  workspace_id: text('workspace_id').notNull(),
  chunk_key: text('chunk_key').notNull(),
  chunk_order: integer('chunk_order').notNull(),
  heading: text('heading'),
  markdown: text('markdown').notNull(),
  token_estimate: integer('token_estimate').notNull(),
  content_hash: text('content_hash').notNull(),
  updated_at: text('updated_at').notNull(),
})

const graphSnapshotsTable = sqliteTable('graph_snapshots', {
  id: text('id').primaryKey(),
  document_id: text('document_id').notNull(),
  workspace_id: text('workspace_id').notNull(),
  graph_revision: integer('graph_revision').notNull(),
  graph_hash: text('graph_hash').notNull(),
  graph_json: text('graph_json').notNull(),
  layout_json: text('layout_json'),
  derived_from_document_revision: integer('derived_from_document_revision').notNull(),
  updated_at: text('updated_at').notNull(),
})

const syncDevicesTable = sqliteTable('sync_devices', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  device_label: text('device_label'),
  last_pull_cursor: text('last_pull_cursor'),
  last_push_cursor: text('last_push_cursor'),
  updated_at: text('updated_at').notNull(),
})

const syncEventsTable = sqliteTable('sync_events', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  device_id: text('device_id').notNull(),
  event_type: text('event_type').notNull(),
  payload_json: text('payload_json').notNull(),
  created_at: text('created_at').notNull(),
})

const createKnowgrphStorageDrizzleDb = (db: D1DatabaseLike) => drizzle(db as never, {
  schema: {
    workspacesTable,
    documentsTable,
    documentChunksTable,
    graphSnapshotsTable,
    syncDevicesTable,
    syncEventsTable,
  },
})

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

export type CrawlerDocumentRow = {
  id: string
  canonical_path: string
  title: string | null
  doc_type: string | null
  content_hash: string
  revision: number
  updated_at: string
  content_length: number
}

export const ensureWorkspaceRow = async (db: D1DatabaseLike, workspaceId: string, nowIso: string): Promise<void> => {
  await createKnowgrphStorageDrizzleDb(db)
    .insert(workspacesTable)
    .values({
      id: workspaceId,
      slug: workspaceId,
      title: workspaceId,
      visibility: 'private',
      created_at: nowIso,
      updated_at: nowIso,
    })
    .onConflictDoNothing()
}

export const ensureSyncDeviceRow = async (
  db: D1DatabaseLike,
  workspaceId: string,
  deviceId: string,
  nowIso: string,
): Promise<void> => {
  await createKnowgrphStorageDrizzleDb(db)
    .insert(syncDevicesTable)
    .values({
      id: deviceId,
      workspace_id: workspaceId,
      device_label: deviceId,
      last_pull_cursor: null,
      last_push_cursor: null,
      updated_at: nowIso,
    })
    .onConflictDoNothing()
}

const SYNC_EVENT_RETENTION_HOURS = 24

export const pruneStaleSyncEvents = async (db: D1DatabaseLike, nowIso: string): Promise<void> => {
  const cutoff = new Date(Date.parse(nowIso) - SYNC_EVENT_RETENTION_HOURS * 3600_000).toISOString()
  await createKnowgrphStorageDrizzleDb(db)
    .delete(syncEventsTable)
    .where(lt(syncEventsTable.created_at, cutoff))
}

export const writeSyncEvent = async (
  db: D1DatabaseLike,
  args: { workspaceId: string; deviceId: string; eventType: string; payload: Record<string, unknown>; nowIso: string },
): Promise<void> => {
  const eventId = `${args.eventType}:${Date.now()}:${Math.random().toString(16).slice(2)}`
  await createKnowgrphStorageDrizzleDb(db)
    .insert(syncEventsTable)
    .values({
      id: eventId,
      workspace_id: args.workspaceId,
      device_id: args.deviceId,
      event_type: args.eventType,
      payload_json: JSON.stringify(args.payload),
      created_at: args.nowIso,
    })
}

export const readPullChangeRows = async (
  db: D1DatabaseLike,
  workspaceId: string,
  since: string | null,
): Promise<{
  documents: DocumentRow[]
  documentChunks: DocumentChunkRow[]
  graphSnapshots: GraphSnapshotRow[]
}> => {
  const repo = createKnowgrphStorageDrizzleDb(db)
  const sinceValue = normalizeNullableString(since)
  const documentPredicate = sinceValue
    ? and(eq(documentsTable.workspace_id, workspaceId), gt(documentsTable.updated_at, sinceValue))
    : eq(documentsTable.workspace_id, workspaceId)
  const chunkPredicate = sinceValue
    ? and(eq(documentChunksTable.workspace_id, workspaceId), gt(documentChunksTable.updated_at, sinceValue))
    : eq(documentChunksTable.workspace_id, workspaceId)
  const graphPredicate = sinceValue
    ? and(eq(graphSnapshotsTable.workspace_id, workspaceId), gt(graphSnapshotsTable.updated_at, sinceValue))
    : eq(graphSnapshotsTable.workspace_id, workspaceId)

  const [documents, documentChunks, graphSnapshots] = await Promise.all([
    repo.select().from(documentsTable).where(documentPredicate).orderBy(asc(documentsTable.updated_at)).all(),
    repo.select().from(documentChunksTable).where(chunkPredicate).orderBy(asc(documentChunksTable.updated_at)).all(),
    repo.select().from(graphSnapshotsTable).where(graphPredicate).orderBy(asc(graphSnapshotsTable.updated_at)).all(),
  ])

  return {
    documents: documents as DocumentRow[],
    documentChunks: documentChunks as DocumentChunkRow[],
    graphSnapshots: graphSnapshots as GraphSnapshotRow[],
  }
}

export const readPublishedDocumentRow = async (
  db: D1DatabaseLike,
  workspaceId: string,
  canonicalPath: string,
): Promise<Pick<DocumentRow, 'id' | 'content_md'> | null> => {
  const repo = createKnowgrphStorageDrizzleDb(db)
  const rows = await repo
    .select({ id: documentsTable.id, content_md: documentsTable.content_md })
    .from(documentsTable)
    .where(and(
      eq(documentsTable.workspace_id, workspaceId),
      eq(documentsTable.canonical_path, canonicalPath),
      eq(documentsTable.deleted, 0),
    ))
    .limit(1)
    .all()
  return (rows[0] as Pick<DocumentRow, 'id' | 'content_md'> | undefined) ?? null
}

export const readPublishedChunkRows = async (
  db: D1DatabaseLike,
  workspaceId: string,
  documentId: string,
): Promise<Array<Pick<DocumentChunkRow, 'id' | 'chunk_order' | 'markdown'>>> => {
  const repo = createKnowgrphStorageDrizzleDb(db)
  const rows = await repo
    .select({
      id: documentChunksTable.id,
      chunk_order: documentChunksTable.chunk_order,
      markdown: documentChunksTable.markdown,
    })
    .from(documentChunksTable)
    .where(and(
      eq(documentChunksTable.workspace_id, workspaceId),
      eq(documentChunksTable.document_id, documentId),
    ))
    .orderBy(asc(documentChunksTable.chunk_order), asc(documentChunksTable.id))
    .all()
  return rows as Array<Pick<DocumentChunkRow, 'id' | 'chunk_order' | 'markdown'>>
}

export const readCrawlerDocumentRows = async (
  db: D1DatabaseLike,
  workspaceId: string,
): Promise<CrawlerDocumentRow[]> => {
  const repo = createKnowgrphStorageDrizzleDb(db)
  const rows = await repo
    .select({
      id: documentsTable.id,
      canonical_path: documentsTable.canonical_path,
      title: documentsTable.title,
      doc_type: documentsTable.doc_type,
      content_hash: documentsTable.content_hash,
      revision: documentsTable.revision,
      updated_at: documentsTable.updated_at,
      content_length: sql<number>`length(coalesce(${documentsTable.content_md}, ''))`,
    })
    .from(documentsTable)
    .where(and(eq(documentsTable.workspace_id, workspaceId), eq(documentsTable.deleted, 0)))
    .orderBy(asc(documentsTable.canonical_path), asc(documentsTable.id))
    .all()
  return rows as CrawlerDocumentRow[]
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
