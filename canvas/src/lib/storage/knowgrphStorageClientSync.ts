import { scheduleWorkspaceSyncTask, cancelWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { getLocalStorage } from '@/lib/persistence'
import {
  buildKnowgrphStoragePullRequest,
  buildKnowgrphStorageCursorId,
  buildKnowgrphStorageExportPath,
  buildKnowgrphStorageOutboxId,
  KNOWGRPH_STORAGE_API_VERSION,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
  type KgDocumentChunkRecord,
  type KgDocumentRecord,
  type KgGraphSnapshotRecord,
  type KnowgrphStorageCursorRecord,
  type KnowgrphStorageMutation,
  type KnowgrphStoragePullResponse,
  type KnowgrphStoragePushResponse,
} from '@/lib/storage/knowgrphStorageSyncContract'
import {
  getKnowgrphStorageDb,
  type KgDocumentLocalRecord,
  type KnowgrphStorageCollections,
  type KnowgrphStorageDb,
} from '@/lib/storage/knowgrphStorageRxdb'

const KNOWGRPH_STORAGE_DEVICE_ID_KEY = 'kg:knowgrph-storage:device-id'
const KNOWGRPH_STORAGE_SYNC_TASK_PREFIX = 'knowgrph-storage:sync'
const KNOWGRPH_STORAGE_SYNC_POLL_PREFIX = 'knowgrph-storage:poll'
const DEFAULT_PUSH_BATCH_SIZE = 50
const DEFAULT_MAX_RETRY_COUNT = 3
const DEFAULT_POLL_INTERVAL_MS = 30_000
const DEFAULT_SCHEDULE_DELAY_MS = 250
const KNOWGRPH_STORAGE_ROUTE_UNAVAILABLE_RETRY_MS = 10_000

type KnowgrphStorageFetchLike = typeof fetch

export type QueueKnowgrphStorageMutationArgs =
  | {
      workspaceId: string
      deviceId?: string | null
      entity: 'document'
      op: 'upsert' | 'delete'
      recordId?: string | null
      record: KgDocumentRecord
      baseRevision?: number | null
      dbState?: KnowgrphStorageDb | null
    }
  | {
      workspaceId: string
      deviceId?: string | null
      entity: 'documentChunk'
      op: 'upsert' | 'delete'
      recordId?: string | null
      record: KgDocumentChunkRecord
      baseRevision?: number | null
      dbState?: KnowgrphStorageDb | null
    }
  | {
      workspaceId: string
      deviceId?: string | null
      entity: 'graphSnapshot'
      op: 'upsert' | 'delete'
      recordId?: string | null
      record: KgGraphSnapshotRecord
      baseRevision?: number | null
      dbState?: KnowgrphStorageDb | null
    }

export type KnowgrphStorageSyncNowArgs = {
  workspaceId: string
  deviceId?: string | null
  baseUrl?: string | null
  fetchImpl?: KnowgrphStorageFetchLike
  pushBatchSize?: number
  maxRetryCount?: number
  onPulledChangesApplied?: ((args: {
    workspaceId: string
    deviceId: string
    changes: KnowgrphStoragePullResponse['changes']
  }) => void | Promise<void>) | null
  onSyncCompleted?: ((result: KnowgrphStorageSyncRunResult) => void | Promise<void>) | null
  dbState?: KnowgrphStorageDb | null
}

export type KnowgrphStorageSyncRunResult = {
  workspaceId: string
  deviceId: string
  pushedCount: number
  pulledDocumentCount: number
  pulledChunkCount: number
  pulledGraphSnapshotCount: number
  appliedCount: number
  conflictCount: number
  rejectedCount: number
  deferredCount: number
  unresolvedConflictCount: number
  conflictEntries: Array<{
    mutationId: string
    entity: string
    recordId: string
    message: string | null
  }>
  lastPushCursor: string | null
  lastPullCursor: string | null
}

type SyncPushOutcome = {
  pushedCount: number
  appliedCount: number
  conflictCount: number
  autoRebasedConflictCount: number
  rejectedCount: number
  deferredCount: number
  conflictEntries: KnowgrphStorageSyncRunResult['conflictEntries']
  ackCursor: string | null
}

const inFlightSyncByWorkspace = new Map<string, Promise<KnowgrphStorageSyncRunResult>>()
const pollTimerByWorkspace = new Map<string, number>()
const routeUnavailableUntilByApiOrigin = new Map<string, number>()

class KnowgrphStorageRouteUnavailableError extends Error {
  apiOrigin: string

  constructor(message: string, apiOrigin: string) {
    super(message)
    this.name = 'KnowgrphStorageRouteUnavailableError'
    this.apiOrigin = apiOrigin
  }
}

const normalizeString = (value: unknown): string => String(value || '').trim()
const normalizePositiveInt = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

const getClientFetch = (value?: KnowgrphStorageFetchLike): KnowgrphStorageFetchLike => {
  if (value) return value
  if (typeof fetch !== 'function') throw new Error('fetch is not available for knowgrph storage sync')
  return fetch
}

const buildApiOriginKey = (baseUrl?: string | null): string => {
  try {
    return new URL(resolveApiUrl(KNOWGRPH_STORAGE_ROUTE_PATHS.push, baseUrl)).origin
  } catch {
    return normalizeString(baseUrl) || 'window-origin'
  }
}

const markRouteUnavailableForApiOrigin = (apiOrigin: string, nowMs = Date.now()): void => {
  if (!apiOrigin) return
  routeUnavailableUntilByApiOrigin.set(apiOrigin, nowMs + KNOWGRPH_STORAGE_ROUTE_UNAVAILABLE_RETRY_MS)
  console.warn(`[knowgrph-storage] route unavailable for ${apiOrigin} — retry in ${KNOWGRPH_STORAGE_ROUTE_UNAVAILABLE_RETRY_MS}ms`)
}

const isRouteUnavailableForApiOrigin = (apiOrigin: string, nowMs = Date.now()): boolean => {
  if (!apiOrigin) return false
  const untilMs = Number(routeUnavailableUntilByApiOrigin.get(apiOrigin) || 0)
  if (!Number.isFinite(untilMs) || untilMs <= nowMs) {
    routeUnavailableUntilByApiOrigin.delete(apiOrigin)
    return false
  }
  return true
}

const isLikelyHtmlDocument = (value: string): boolean => {
  const text = String(value || '').trim().toLowerCase()
  return text.startsWith('<!doctype html') || text.startsWith('<html')
}

const parseStorageResponseJson = async <T>(
  response: Response,
  args: { requestLabel: string; apiOrigin: string },
): Promise<T> => {
  const contentType = normalizeString(response.headers.get('content-type')).toLowerCase()
  const text = await response.text()
  const trimmed = String(text || '').trim()
  const isJsonLikeContentType = contentType.includes('application/json') || contentType.endsWith('+json')
  const routeUnavailable =
    response.status === 404
    || (!trimmed && !response.ok)
    || isLikelyHtmlDocument(trimmed)
  if (routeUnavailable) {
    markRouteUnavailableForApiOrigin(args.apiOrigin)
    throw new KnowgrphStorageRouteUnavailableError(
      `${args.requestLabel} is unavailable for ${args.apiOrigin}`,
      args.apiOrigin,
    )
  }
  if (!trimmed) {
    throw new Error(`${args.requestLabel} returned an empty response body`)
  }
  try {
    return JSON.parse(trimmed) as T
  } catch (error) {
    if (!isJsonLikeContentType) {
      throw new Error(`${args.requestLabel} returned a non-JSON response (${contentType || 'unknown content type'})`)
    }
    const message = error instanceof Error ? error.message : 'invalid JSON'
    throw new Error(`${args.requestLabel} returned invalid JSON: ${message}`)
  }
}

const buildSkippedSyncResult = (args: {
  workspaceId: string
  deviceId: string
  currentCursor: Awaited<ReturnType<typeof readCursorRow>>
  unresolvedConflictCount: number
}): KnowgrphStorageSyncRunResult => ({
  workspaceId: args.workspaceId,
  deviceId: args.deviceId,
  pushedCount: 0,
  pulledDocumentCount: 0,
  pulledChunkCount: 0,
  pulledGraphSnapshotCount: 0,
  appliedCount: 0,
  conflictCount: 0,
  rejectedCount: 0,
  deferredCount: 0,
  unresolvedConflictCount: args.unresolvedConflictCount,
  conflictEntries: [],
  lastPushCursor: normalizeString(args.currentCursor?.get('lastPushCursor')) || null,
  lastPullCursor: normalizeString(args.currentCursor?.get('lastPullCursor')) || null,
})

const resolveApiUrl = (path: string, baseUrl?: string | null): string => {
  const safePath = normalizeString(path)
  const explicitBase = normalizeString(baseUrl)
  if (/^https?:\/\//i.test(safePath)) return safePath
  if (explicitBase) return new URL(safePath, explicitBase.endsWith('/') ? explicitBase : `${explicitBase}/`).toString()
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(safePath, window.location.origin).toString()
  }
  return new URL(safePath, 'https://example.invalid').toString()
}

const getDbState = async (dbState?: KnowgrphStorageDb | null): Promise<KnowgrphStorageDb> => {
  if (dbState) return dbState
  return getKnowgrphStorageDb()
}

export const getKnowgrphStorageDeviceId = (storage: Storage | null = getLocalStorage()): string => {
  try {
    const existing = normalizeString(storage?.getItem(KNOWGRPH_STORAGE_DEVICE_ID_KEY))
    if (existing) return existing
    const next =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `dev:${crypto.randomUUID()}`
        : `dev:${Date.now()}:${Math.random().toString(16).slice(2)}`
    storage?.setItem(KNOWGRPH_STORAGE_DEVICE_ID_KEY, next)
    return next
  } catch {
    return `dev:${Date.now()}:${Math.random().toString(16).slice(2)}`
  }
}

const readCursorRow = async (
  collections: KnowgrphStorageCollections,
  workspaceId: string,
  deviceId: string,
) => collections.syncCursor.findOne(buildKnowgrphStorageCursorId(workspaceId, deviceId)).exec()

const upsertCursorRow = async (
  collections: KnowgrphStorageCollections,
  cursor: KnowgrphStorageCursorRecord,
): Promise<void> => {
  await collections.syncCursor.incrementalUpsert(cursor)
}

const readPendingOutboxDocs = async (
  collections: KnowgrphStorageCollections,
  workspaceId: string,
  maxRetryCount: number,
  limit: number,
) => {
  const rows = await collections.syncOutbox
    .find({ selector: { workspaceId } })
    .sort({ createdAtMs: 'asc' })
    .exec()
  return rows
    .filter(row => Number(row.get('attemptCount') || 0) < maxRetryCount)
    .slice(0, limit)
}

const removeOutboxDocById = async (collections: KnowgrphStorageCollections, id: string): Promise<void> => {
  const existing = await collections.syncOutbox.findOne(id).exec()
  if (!existing) return
  await existing.remove()
}

const bumpOutboxAttemptCount = async (
  collections: KnowgrphStorageCollections,
  id: string,
  args: {
    nextAttemptCount: number
    nowMs: number
    lastAckStatus: 'conflict' | 'rejected' | 'deferred' | ''
    lastAckMessage: string | null
  },
): Promise<void> => {
  const existing = await collections.syncOutbox.findOne(id).exec()
  if (!existing) return
  await existing.incrementalPatch({
    attemptCount: args.nextAttemptCount,
    updatedAtMs: args.nowMs,
    lastAckStatus: args.lastAckStatus,
    lastAckMessage: args.lastAckMessage,
  })
}

const patchOutboxForAutoRebaseRetry = async (args: {
  collections: KnowgrphStorageCollections
  mutationId: string
  mutation: KnowgrphStorageMutation
  nextBaseRevision: number | null
  nextRecord: KnowgrphStorageMutation['record']
  nowMs: number
}): Promise<void> => {
  const existing = await args.collections.syncOutbox.findOne(args.mutationId).exec()
  if (!existing) return
  const nextMutation: KnowgrphStorageMutation = {
    ...args.mutation,
    baseRevision: args.nextBaseRevision,
    record: args.nextRecord as never,
  }
  await existing.incrementalPatch({
    baseRevision: args.nextBaseRevision,
    payload: nextMutation as unknown as Record<string, unknown>,
    payloadHash: hashStringToHex(JSON.stringify(nextMutation)),
    attemptCount: 0,
    lastAckStatus: '',
    lastAckMessage: null,
    updatedAtMs: args.nowMs,
  })
}

const autoRebaseKeepLocalConflict = async (args: {
  collections: KnowgrphStorageCollections
  acknowledgement: KnowgrphStoragePushResponse['acknowledgements'][number]
  mutation: KnowgrphStorageMutation
  nowMs: number
}): Promise<boolean> => {
  const serverReportedRevision = Number(args.acknowledgement.currentServerRevision)
  const normalizedServerReportedRevision = Number.isFinite(serverReportedRevision) && serverReportedRevision >= 0
    ? Math.floor(serverReportedRevision)
    : null
  const recordId = normalizeString(args.acknowledgement.recordId || args.mutation.recordId)
  if (!recordId) return false
  if (args.mutation.entity === 'document') {
    const currentRecord = args.mutation.record as KgDocumentRecord
    const remoteDoc = await args.collections.documents.findOne(recordId).exec()
    const remoteRevision = normalizedServerReportedRevision ?? Number(remoteDoc?.get('documentRevision') || 0)
    const nextRecord: KgDocumentRecord = {
      ...currentRecord,
      revision: Math.max(remoteRevision + 1, Number(currentRecord.revision || 0) || 1),
      updatedAtMs: args.nowMs,
    }
    await args.collections.documents.incrementalUpsert({
      ...nextRecord,
      documentRevision: nextRecord.revision,
      isDeleted: nextRecord.deleted,
    })
    await patchOutboxForAutoRebaseRetry({
      collections: args.collections,
      mutationId: args.acknowledgement.mutationId,
      mutation: args.mutation,
      nextBaseRevision: remoteRevision || null,
      nextRecord,
      nowMs: args.nowMs,
    })
    return true
  }
  if (args.mutation.entity === 'graphSnapshot') {
    const currentRecord = args.mutation.record as KgGraphSnapshotRecord
    const remoteGraph = await args.collections.graphSnapshots.findOne(recordId).exec()
    const remoteRevision = normalizedServerReportedRevision ?? Number(remoteGraph?.get('graphRevision') || 0)
    const nextRecord: KgGraphSnapshotRecord = {
      ...currentRecord,
      graphRevision: Math.max(remoteRevision + 1, Number(currentRecord.graphRevision || 0) || 1),
      updatedAtMs: args.nowMs,
    }
    await args.collections.graphSnapshots.incrementalUpsert(nextRecord)
    await patchOutboxForAutoRebaseRetry({
      collections: args.collections,
      mutationId: args.acknowledgement.mutationId,
      mutation: args.mutation,
      nextBaseRevision: remoteRevision || null,
      nextRecord,
      nowMs: args.nowMs,
    })
    return true
  }
  return false
}

const readUnresolvedConflictCount = async (
  collections: KnowgrphStorageCollections,
  workspaceId: string,
): Promise<number> => {
  const rows = await collections.syncOutbox
    .find({ selector: { workspaceId, lastAckStatus: 'conflict' } })
    .exec()
  return rows.length
}

const autoClearStaleOutboxConflicts = async (
  collections: KnowgrphStorageCollections,
  workspaceId: string,
  pulledDocuments: KgDocumentRecord[],
  pulledGraphSnapshots: KgGraphSnapshotRecord[],
): Promise<number> => {
  const conflictRows = await collections.syncOutbox
    .find({ selector: { workspaceId, lastAckStatus: 'conflict' } })
    .exec()
  if (conflictRows.length === 0) return 0

  const serverDocRevisions = new Map<string, number>()
  for (const doc of pulledDocuments) {
    serverDocRevisions.set(doc.id, doc.revision)
  }
  const serverGraphRevisions = new Map<string, number>()
  for (const snap of pulledGraphSnapshots) {
    serverGraphRevisions.set(snap.id, snap.graphRevision)
  }

  let clearedCount = 0
  for (const row of conflictRows) {
    const entity = normalizeString(row.get('entity'))
    const recordId = normalizeString(row.get('recordId'))
    const payload = row.get('payload') as Record<string, unknown> | null
    const record = (payload?.record ?? {}) as Record<string, unknown>
    const localRevision = Number(record.revision ?? record.graphRevision ?? 0)

    if (entity === 'document') {
      const serverRevision = serverDocRevisions.get(recordId)
      if (serverRevision != null && serverRevision >= localRevision) {
        await row.remove()
        clearedCount += 1
        continue
      }
    }
    if (entity === 'graphSnapshot') {
      const serverRevision = serverGraphRevisions.get(recordId)
      if (serverRevision != null && serverRevision >= localRevision) {
        await row.remove()
        clearedCount += 1
        continue
      }
    }
  }
  if (clearedCount > 0) {
    console.log(`[knowgrph-storage] auto-cleared ${clearedCount} stale outbox conflicts for workspace ${workspaceId}`)
  }
  return clearedCount
}

const applyPulledDocuments = async (collections: KnowgrphStorageCollections, documents: KgDocumentRecord[]): Promise<void> => {
  for (let i = 0; i < documents.length; i += 1) {
    const document = documents[i]!
    const { revision, deleted, ...rest } = document
    const localRecord: KgDocumentLocalRecord = {
      ...rest,
      documentRevision: revision,
      isDeleted: deleted,
    }
    await collections.documents.incrementalUpsert(localRecord)
  }
}

const applyPulledDocumentChunks = async (
  collections: KnowgrphStorageCollections,
  chunks: KgDocumentChunkRecord[],
): Promise<void> => {
  for (let i = 0; i < chunks.length; i += 1) {
    await collections.documentChunks.incrementalUpsert(chunks[i]!)
  }
}

const applyPulledGraphSnapshots = async (
  collections: KnowgrphStorageCollections,
  snapshots: KgGraphSnapshotRecord[],
): Promise<void> => {
  for (let i = 0; i < snapshots.length; i += 1) {
    await collections.graphSnapshots.incrementalUpsert(snapshots[i]!)
  }
}

export const queueKnowgrphStorageMutation = async (
  args: QueueKnowgrphStorageMutationArgs,
): Promise<string> => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) throw new Error('workspaceId is required to queue a storage mutation')
  const dbState = await getDbState(args.dbState)
  const deviceId = normalizeString(args.deviceId) || getKnowgrphStorageDeviceId()
  const mutationId = buildKnowgrphStorageOutboxId('mut')
  const recordId = normalizeString(args.recordId) || normalizeString(args.record.id)
  if (!recordId) throw new Error('recordId is required to queue a storage mutation')
  const payload: KnowgrphStorageMutation = {
    mutationId,
    workspaceId,
    entity: args.entity,
    op: args.op,
    recordId,
    baseRevision: args.baseRevision ?? null,
    record: args.record as never,
  }
  const payloadText = JSON.stringify(payload)
  const nowMs = Date.now()
  await dbState.collections.syncOutbox.incrementalUpsert({
    id: mutationId,
    workspaceId,
    deviceId,
    entity: args.entity,
    op: args.op,
    recordId,
    baseRevision: args.baseRevision ?? null,
    payload: payload as unknown as Record<string, unknown>,
    payloadHash: hashStringToHex(payloadText),
    attemptCount: 0,
    lastAckStatus: '',
    lastAckMessage: null,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  })
  return mutationId
}

const pushKnowgrphStorageOutbox = async (
  args: Required<Pick<KnowgrphStorageSyncNowArgs, 'workspaceId'>> &
    Pick<KnowgrphStorageSyncNowArgs, 'baseUrl' | 'fetchImpl'> & {
      deviceId: string
      maxRetryCount: number
      pushBatchSize: number
      collections: KnowgrphStorageCollections
    },
): Promise<SyncPushOutcome> => {
  const outboxDocs = await readPendingOutboxDocs(args.collections, args.workspaceId, args.maxRetryCount, args.pushBatchSize)
  if (outboxDocs.length === 0) {
    return {
      pushedCount: 0,
      appliedCount: 0,
      conflictCount: 0,
      autoRebasedConflictCount: 0,
      rejectedCount: 0,
      deferredCount: 0,
      conflictEntries: [],
      ackCursor: null,
    }
  }
  const fetchImpl = getClientFetch(args.fetchImpl)
  const apiOrigin = buildApiOriginKey(args.baseUrl)
  const mutations = outboxDocs.map(doc => doc.get('payload') as unknown as KnowgrphStorageMutation)
  const response = await fetchImpl(resolveApiUrl(KNOWGRPH_STORAGE_ROUTE_PATHS.push, args.baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiVersion: KNOWGRPH_STORAGE_API_VERSION,
      workspaceId: args.workspaceId,
      deviceId: args.deviceId,
      mutations,
    }),
  })
  const json = await parseStorageResponseJson<KnowgrphStoragePushResponse | { ok?: false; error?: string }>(response, {
    requestLabel: 'knowgrph storage push',
    apiOrigin,
  })
  if (!response.ok || !('ok' in json) || json.ok !== true) {
    throw new Error(`knowgrph storage push failed: ${'error' in json ? String(json.error || 'request failed') : 'request failed'}`)
  }
  let appliedCount = 0
  let conflictCount = 0
  let autoRebasedConflictCount = 0
  let rejectedCount = 0
  const conflictEntries: KnowgrphStorageSyncRunResult['conflictEntries'] = []
  const handledMutationIds = new Set<string>()
  const nowMs = Date.now()
  for (let i = 0; i < json.acknowledgements.length; i += 1) {
    const acknowledgement = json.acknowledgements[i]!
    handledMutationIds.add(acknowledgement.mutationId)
    const outboxDoc = outboxDocs.find(doc => doc.get('id') === acknowledgement.mutationId)
    if (!outboxDoc) continue
    if (acknowledgement.status === 'applied') {
      appliedCount += 1
      await removeOutboxDocById(args.collections, acknowledgement.mutationId)
      continue
    }
    const attemptCount = normalizePositiveInt(outboxDoc.get('attemptCount'), 0) + 1
    if (acknowledgement.status === 'conflict') {
      const mutation = outboxDoc.get('payload') as unknown as KnowgrphStorageMutation
      const autoRebased = await autoRebaseKeepLocalConflict({
        collections: args.collections,
        acknowledgement,
        mutation,
        nowMs,
      })
      if (autoRebased) {
        autoRebasedConflictCount += 1
        continue
      }
      await bumpOutboxAttemptCount(args.collections, acknowledgement.mutationId, {
        nextAttemptCount: attemptCount,
        nowMs,
        lastAckStatus: 'conflict',
        lastAckMessage: acknowledgement.message || null,
      })
      conflictCount += 1
      conflictEntries.push({
        mutationId: acknowledgement.mutationId,
        entity: acknowledgement.entity,
        recordId: acknowledgement.recordId,
        message: acknowledgement.message || null,
      })
      continue
    }
    await bumpOutboxAttemptCount(args.collections, acknowledgement.mutationId, {
      nextAttemptCount: attemptCount,
      nowMs,
      lastAckStatus: 'rejected',
      lastAckMessage: acknowledgement.message || null,
    })
    rejectedCount += 1
  }
  let deferredCount = 0
  for (let i = 0; i < outboxDocs.length; i += 1) {
    const doc = outboxDocs[i]!
    const id = normalizeString(doc.get('id'))
    if (!id || handledMutationIds.has(id)) continue
    const attemptCount = normalizePositiveInt(doc.get('attemptCount'), 0) + 1
    await bumpOutboxAttemptCount(args.collections, id, {
      nextAttemptCount: attemptCount,
      nowMs,
      lastAckStatus: 'deferred',
      lastAckMessage: 'No acknowledgement received for queued mutation during the latest sync attempt.',
    })
    deferredCount += 1
  }
  return {
    pushedCount: outboxDocs.length,
    appliedCount,
    conflictCount,
    autoRebasedConflictCount,
    rejectedCount,
    deferredCount,
    conflictEntries,
    ackCursor: json.ackCursor || null,
  }
}

const pullKnowgrphStorageChanges = async (
  args: Required<Pick<KnowgrphStorageSyncNowArgs, 'workspaceId'>> &
    Pick<KnowgrphStorageSyncNowArgs, 'baseUrl' | 'fetchImpl'> & {
      deviceId: string
      since: string | null
      collections: KnowgrphStorageCollections
    },
) => {
  const fetchImpl = getClientFetch(args.fetchImpl)
  const apiOrigin = buildApiOriginKey(args.baseUrl)
  const response = await fetchImpl(resolveApiUrl(KNOWGRPH_STORAGE_ROUTE_PATHS.pull, args.baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      buildKnowgrphStoragePullRequest({
        workspaceId: args.workspaceId,
        deviceId: args.deviceId,
        since: args.since,
      }),
    ),
  })
  const json = await parseStorageResponseJson<KnowgrphStoragePullResponse | { ok?: false; error?: string }>(response, {
    requestLabel: 'knowgrph storage pull',
    apiOrigin,
  })
  if (!response.ok || !('ok' in json) || json.ok !== true) {
    throw new Error(`knowgrph storage pull failed: ${'error' in json ? String(json.error || 'request failed') : 'request failed'}`)
  }
  await applyPulledDocuments(args.collections, json.changes.documents)
    await applyPulledDocumentChunks(args.collections, json.changes.documentChunks)
    await applyPulledGraphSnapshots(args.collections, json.changes.graphSnapshots)
    await autoClearStaleOutboxConflicts(
      args.collections,
      args.workspaceId,
      json.changes.documents,
      json.changes.graphSnapshots,
    )
    return json
}

export const syncKnowgrphStorageNow = async (
  args: KnowgrphStorageSyncNowArgs,
): Promise<KnowgrphStorageSyncRunResult> => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) throw new Error('workspaceId is required for knowgrph storage sync')
  const deviceId = normalizeString(args.deviceId) || getKnowgrphStorageDeviceId()
  const apiOrigin = buildApiOriginKey(args.baseUrl)
  const inFlightKey = `${workspaceId}::${deviceId}`
  const existingInFlight = inFlightSyncByWorkspace.get(inFlightKey)
  if (existingInFlight) return existingInFlight
  const run = (async (): Promise<KnowgrphStorageSyncRunResult> => {
    const dbState = await getDbState(args.dbState)
    const { collections } = dbState
    const currentCursor = await readCursorRow(collections, workspaceId, deviceId)
    const unresolvedConflictCount = await readUnresolvedConflictCount(collections, workspaceId)
    if (isRouteUnavailableForApiOrigin(apiOrigin)) {
      console.warn(`[knowgrph-storage] sync skipped — route unavailable for ${apiOrigin}`)
      return buildSkippedSyncResult({
        workspaceId,
        deviceId,
        currentCursor,
        unresolvedConflictCount,
      })
    }
    const pushBatchSize = normalizePositiveInt(args.pushBatchSize, DEFAULT_PUSH_BATCH_SIZE)
    const maxRetryCount = normalizePositiveInt(args.maxRetryCount, DEFAULT_MAX_RETRY_COUNT)
    try {
    const pushOutcome = await pushKnowgrphStorageOutbox({
      workspaceId,
      deviceId,
      baseUrl: args.baseUrl,
      fetchImpl: args.fetchImpl,
      maxRetryCount,
      pushBatchSize,
      collections,
    })
    const pullResponse = await pullKnowgrphStorageChanges({
      workspaceId,
      deviceId,
      since: normalizeString(currentCursor?.get('lastPullCursor')) || null,
      baseUrl: args.baseUrl,
      fetchImpl: args.fetchImpl,
      collections,
    })
    if (typeof args.onPulledChangesApplied === 'function') {
      await args.onPulledChangesApplied({
        workspaceId,
        deviceId,
        changes: pullResponse.changes,
      })
    }
    const nowMs = Date.now()
    await upsertCursorRow(collections, {
      id: buildKnowgrphStorageCursorId(workspaceId, deviceId),
      workspaceId,
      deviceId,
      lastPullCursor: pullResponse.nextCursor || null,
      lastPushCursor: pushOutcome.ackCursor || normalizeString(currentCursor?.get('lastPushCursor')) || null,
      serverClockMs: Number.isFinite(pullResponse.serverTimeMs) ? Math.floor(pullResponse.serverTimeMs) : nowMs,
      updatedAtMs: nowMs,
    })
    const result: KnowgrphStorageSyncRunResult = {
      workspaceId,
      deviceId,
      pushedCount: pushOutcome.pushedCount,
      pulledDocumentCount: pullResponse.changes.documents.length,
      pulledChunkCount: pullResponse.changes.documentChunks.length,
      pulledGraphSnapshotCount: pullResponse.changes.graphSnapshots.length,
      appliedCount: pushOutcome.appliedCount,
      conflictCount: pushOutcome.conflictCount,
      rejectedCount: pushOutcome.rejectedCount,
      deferredCount: pushOutcome.deferredCount,
      unresolvedConflictCount: await readUnresolvedConflictCount(collections, workspaceId),
      conflictEntries: pushOutcome.conflictEntries,
      lastPushCursor: pushOutcome.ackCursor,
      lastPullCursor: pullResponse.nextCursor || null,
    }
    if (pushOutcome.autoRebasedConflictCount > 0) {
      scheduleKnowgrphStorageSync({
        workspaceId,
        deviceId,
        baseUrl: args.baseUrl,
        fetchImpl: args.fetchImpl,
        pushBatchSize,
        maxRetryCount,
        onPulledChangesApplied: args.onPulledChangesApplied,
        onSyncCompleted: args.onSyncCompleted,
        dbState,
        delayMs: 0,
        signature: `${workspaceId}:${deviceId}:auto-rebased-conflicts:${pushOutcome.autoRebasedConflictCount}`,
      })
    }
    if (typeof args.onSyncCompleted === 'function') {
      await args.onSyncCompleted(result)
    }
    console.log(`[knowgrph-storage] sync ok: pushed=${result.pushedCount} pulled=${result.pulledDocumentCount} conflicts=${result.conflictCount} workspace=${workspaceId}`)
    return result
    } catch (error) {
      if (error instanceof KnowgrphStorageRouteUnavailableError) {
        markRouteUnavailableForApiOrigin(error.apiOrigin)
        return buildSkippedSyncResult({
          workspaceId,
          deviceId,
          currentCursor,
          unresolvedConflictCount,
        })
      }
      throw error
    }
  })()
  inFlightSyncByWorkspace.set(inFlightKey, run)
  return run.finally(() => {
    inFlightSyncByWorkspace.delete(inFlightKey)
  })
}

export const scheduleKnowgrphStorageSync = (args: KnowgrphStorageSyncNowArgs & { delayMs?: number; signature?: string | null }): void => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) return
  const deviceId = normalizeString(args.deviceId) || getKnowgrphStorageDeviceId()
  const taskKey = `${KNOWGRPH_STORAGE_SYNC_TASK_PREFIX}:${workspaceId}:${deviceId}`
  const delayMs = Number.isFinite(args.delayMs) ? Math.max(0, Math.floor(args.delayMs || 0)) : DEFAULT_SCHEDULE_DELAY_MS
  scheduleWorkspaceSyncTask(
    taskKey,
    () => {
      void syncKnowgrphStorageNow({ ...args, workspaceId, deviceId }).catch(error => {
        console.error('[knowgrph-storage-sync]', error)
      })
    },
    delayMs,
    {
      scopeKey: `${workspaceId}:${deviceId}`,
      signature: args.signature || `${workspaceId}:${deviceId}`,
    },
  )
}

export const cancelKnowgrphStorageSync = (workspaceId: string, deviceId?: string | null): void => {
  const safeWorkspaceId = normalizeString(workspaceId)
  if (!safeWorkspaceId) return
  const safeDeviceId = normalizeString(deviceId) || getKnowgrphStorageDeviceId()
  cancelWorkspaceSyncTask(`${KNOWGRPH_STORAGE_SYNC_TASK_PREFIX}:${safeWorkspaceId}:${safeDeviceId}`)
}

export const startKnowgrphStorageSyncLoop = (
  args: KnowgrphStorageSyncNowArgs & {
    pollIntervalMs?: number
    initialDelayMs?: number
    signature?: string | null
  },
): (() => void) => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) return () => void 0
  const deviceId = normalizeString(args.deviceId) || getKnowgrphStorageDeviceId()
  const timerKey = `${KNOWGRPH_STORAGE_SYNC_POLL_PREFIX}:${workspaceId}:${deviceId}`
  const intervalMs = normalizePositiveInt(args.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS)
  scheduleKnowgrphStorageSync({
    ...args,
    workspaceId,
    deviceId,
    delayMs: Number.isFinite(args.initialDelayMs) ? Math.max(0, Math.floor(args.initialDelayMs || 0)) : 0,
    signature: args.signature || `${workspaceId}:${deviceId}:initial`,
  })
  if (typeof window === 'undefined') return () => void 0
  const existing = pollTimerByWorkspace.get(timerKey)
  if (typeof existing === 'number') {
    window.clearInterval(existing)
    pollTimerByWorkspace.delete(timerKey)
  }
  const timerId = window.setInterval(() => {
    scheduleKnowgrphStorageSync({
      ...args,
      workspaceId,
      deviceId,
      delayMs: 0,
      signature: `${workspaceId}:${deviceId}:poll`,
    })
  }, intervalMs)
  pollTimerByWorkspace.set(timerKey, timerId)
  return () => {
    cancelKnowgrphStorageSync(workspaceId, deviceId)
    const next = pollTimerByWorkspace.get(timerKey)
    if (typeof next === 'number' && typeof window !== 'undefined') {
      window.clearInterval(next)
    }
    pollTimerByWorkspace.delete(timerKey)
  }
}

export const exportKnowgrphStorageWorkspace = async (
  args: Pick<KnowgrphStorageSyncNowArgs, 'workspaceId' | 'baseUrl' | 'fetchImpl'>,
) => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) throw new Error('workspaceId is required for storage export')
  const fetchImpl = getClientFetch(args.fetchImpl)
  const apiOrigin = buildApiOriginKey(args.baseUrl)
  const response = await fetchImpl(resolveApiUrl(buildKnowgrphStorageExportPath(workspaceId), args.baseUrl), { method: 'GET' })
  const json = await parseStorageResponseJson<Record<string, unknown>>(response, {
    requestLabel: 'knowgrph storage export',
    apiOrigin,
  })
  if (!response.ok || !json || json.ok !== true) {
    throw new Error(`knowgrph storage export failed: ${String((json as { error?: unknown })?.error || 'request failed')}`)
  }
  return json
}
