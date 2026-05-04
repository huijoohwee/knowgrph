export const KNOWGRPH_STORAGE_API_VERSION = '2026-05-04'

export const KNOWGRPH_STORAGE_ROUTE_PATHS = {
  push: '/api/storage/push',
  pull: '/api/storage/pull',
  exportPrefix: '/api/storage/export/',
} as const

export const KNOWGRPH_STORAGE_D1_BINDING_NAME = 'DB'

export const KNOWGRPH_STORAGE_COLLECTION_NAMES = [
  'documents',
  'documentChunks',
  'graphSnapshots',
  'syncOutbox',
  'syncCursor',
] as const

export const KNOWGRPH_STORAGE_D1_TABLE_NAMES = [
  'workspaces',
  'documents',
  'document_chunks',
  'graph_snapshots',
  'sync_devices',
  'sync_events',
] as const

export type KnowgrphStorageCollectionName = (typeof KNOWGRPH_STORAGE_COLLECTION_NAMES)[number]
export type KnowgrphStorageD1TableName = (typeof KNOWGRPH_STORAGE_D1_TABLE_NAMES)[number]

export type KnowgrphStorageEntityKind = 'document' | 'documentChunk' | 'graphSnapshot'
export type KnowgrphStorageMutationOp = 'upsert' | 'delete'

export type KgDocumentRecord = {
  id: string
  workspaceId: string
  canonicalPath: string
  title: string | null
  docType: string | null
  lang: string | null
  graphId: string | null
  sourceKind: 'markdown'
  contentMd: string
  contentHash: string
  parserVersion: string
  revision: number
  updatedAtMs: number
  deleted: boolean
}

export type KgDocumentChunkRecord = {
  id: string
  documentId: string
  workspaceId: string
  chunkKey: string
  chunkOrder: number
  heading: string | null
  markdown: string
  tokenEstimate: number
  contentHash: string
  updatedAtMs: number
}

export type KgGraphSnapshotRecord = {
  id: string
  documentId: string
  workspaceId: string
  graphRevision: number
  graphHash: string
  graphJson: Record<string, unknown>
  layoutJson: Record<string, unknown> | null
  derivedFromDocumentRevision: number
  updatedAtMs: number
}

export type KnowgrphStorageOutboxRecord = {
  id: string
  workspaceId: string
  deviceId: string
  entity: KnowgrphStorageEntityKind
  op: KnowgrphStorageMutationOp
  recordId: string
  baseRevision: number | null
  payload: Record<string, unknown>
  payloadHash: string
  attemptCount: number
  createdAtMs: number
  updatedAtMs: number
}

export type KnowgrphStorageCursorRecord = {
  id: string
  workspaceId: string
  deviceId: string
  lastPullCursor: string | null
  lastPushCursor: string | null
  serverClockMs: number | null
  updatedAtMs: number
}

export type KnowgrphStorageMutationRecord =
  | KgDocumentRecord
  | KgDocumentChunkRecord
  | KgGraphSnapshotRecord

export type KnowgrphStorageMutation =
  | {
      mutationId: string
      workspaceId: string
      entity: 'document'
      op: KnowgrphStorageMutationOp
      recordId: string
      baseRevision: number | null
      record: KgDocumentRecord
    }
  | {
      mutationId: string
      workspaceId: string
      entity: 'documentChunk'
      op: KnowgrphStorageMutationOp
      recordId: string
      baseRevision: number | null
      record: KgDocumentChunkRecord
    }
  | {
      mutationId: string
      workspaceId: string
      entity: 'graphSnapshot'
      op: KnowgrphStorageMutationOp
      recordId: string
      baseRevision: number | null
      record: KgGraphSnapshotRecord
    }

export type KnowgrphStoragePushRequest = {
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  deviceId: string
  mutations: KnowgrphStorageMutation[]
}

export type KnowgrphStorageMutationAck = {
  mutationId: string
  recordId: string
  entity: KnowgrphStorageEntityKind
  status: 'applied' | 'conflict' | 'rejected'
  serverRevision: number | null
  message: string | null
}

export type KnowgrphStoragePushResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  ackCursor: string
  serverTimeMs: number
  acknowledgements: KnowgrphStorageMutationAck[]
}

export type KnowgrphStorageErrorResponse = {
  ok: false
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  error: string
  code: 'bad_request' | 'conflict' | 'forbidden' | 'not_found' | 'server_error'
}

export type KnowgrphStoragePullRequest = {
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  deviceId: string
  since: string | null
}

export type KnowgrphStoragePullChanges = {
  documents: KgDocumentRecord[]
  documentChunks: KgDocumentChunkRecord[]
  graphSnapshots: KgGraphSnapshotRecord[]
}

export type KnowgrphStoragePullResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  nextCursor: string
  serverTimeMs: number
  changes: KnowgrphStoragePullChanges
}

export type KnowgrphStorageExportResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  exportedAtMs: number
  documents: KgDocumentRecord[]
  documentChunks: KgDocumentChunkRecord[]
  graphSnapshots: KgGraphSnapshotRecord[]
}

export type KnowgrphStorageWorkerEnv = {
  DB: unknown
  KNOWGRPH_STORAGE_SIGNING_SECRET?: string
  KNOWGRPH_STORAGE_BLOB_BUCKET?: unknown
}

export const isKnowgrphStorageEntityKind = (value: unknown): value is KnowgrphStorageEntityKind =>
  value === 'document' || value === 'documentChunk' || value === 'graphSnapshot'

export const buildKnowgrphStoragePullPath = (args: {
  workspaceId: string
  deviceId: string
  since?: string | null
}): string => {
  const params = new URLSearchParams()
  params.set('workspaceId', String(args.workspaceId || '').trim())
  params.set('deviceId', String(args.deviceId || '').trim())
  const since = typeof args.since === 'string' ? args.since.trim() : ''
  if (since) params.set('since', since)
  return `${KNOWGRPH_STORAGE_ROUTE_PATHS.pull}?${params.toString()}`
}

export const buildKnowgrphStorageExportPath = (workspaceId: string): string =>
  `/api/storage/export/${encodeURIComponent(String(workspaceId || '').trim())}`

export const buildKnowgrphStorageCursorId = (workspaceId: string, deviceId: string): string =>
  `${String(workspaceId || '').trim()}:${String(deviceId || '').trim()}`

export const buildKnowgrphStorageOutboxId = (prefix = 'mut'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`
}
