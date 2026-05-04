import { scheduleWorkspaceSyncTask, cancelWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { getLocalStorage } from '@/lib/persistence'
import {
  buildKnowgrphStorageCursorId,
  buildKnowgrphStorageExportPath,
  buildKnowgrphStorageOutboxId,
  buildKnowgrphStoragePullPath,
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
  lastPushCursor: string | null
  lastPullCursor: string | null
}

type SyncPushOutcome = {
  pushedCount: number
  appliedCount: number
  conflictCount: number
  rejectedCount: number
  deferredCount: number
  ackCursor: string | null
}

const inFlightSyncByWorkspace = new Map<string, Promise<KnowgrphStorageSyncRunResult>>()
const pollTimerByWorkspace = new Map<string, number>()

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
  nextAttemptCount: number,
  nowMs: number,
): Promise<void> => {
  const existing = await collections.syncOutbox.findOne(id).exec()
  if (!existing) return
  await existing.incrementalPatch({
    attemptCount: nextAttemptCount,
    updatedAtMs: nowMs,
  })
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
      rejectedCount: 0,
      deferredCount: 0,
      ackCursor: null,
    }
  }
  const fetchImpl = getClientFetch(args.fetchImpl)
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
  const json = (await response.json()) as KnowgrphStoragePushResponse | { ok?: false; error?: string }
  if (!response.ok || !('ok' in json) || json.ok !== true) {
    throw new Error(`knowgrph storage push failed: ${'error' in json ? String(json.error || 'request failed') : 'request failed'}`)
  }
  let appliedCount = 0
  let conflictCount = 0
  let rejectedCount = 0
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
    await bumpOutboxAttemptCount(args.collections, acknowledgement.mutationId, attemptCount, nowMs)
    if (acknowledgement.status === 'conflict') {
      conflictCount += 1
      continue
    }
    rejectedCount += 1
  }
  let deferredCount = 0
  for (let i = 0; i < outboxDocs.length; i += 1) {
    const doc = outboxDocs[i]!
    const id = normalizeString(doc.get('id'))
    if (!id || handledMutationIds.has(id)) continue
    const attemptCount = normalizePositiveInt(doc.get('attemptCount'), 0) + 1
    await bumpOutboxAttemptCount(args.collections, id, attemptCount, nowMs)
    deferredCount += 1
  }
  return {
    pushedCount: outboxDocs.length,
    appliedCount,
    conflictCount,
    rejectedCount,
    deferredCount,
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
  const response = await fetchImpl(
    resolveApiUrl(
      buildKnowgrphStoragePullPath({
        workspaceId: args.workspaceId,
        deviceId: args.deviceId,
        since: args.since,
      }),
      args.baseUrl,
    ),
    { method: 'GET' },
  )
  const json = (await response.json()) as KnowgrphStoragePullResponse | { ok?: false; error?: string }
  if (!response.ok || !('ok' in json) || json.ok !== true) {
    throw new Error(`knowgrph storage pull failed: ${'error' in json ? String(json.error || 'request failed') : 'request failed'}`)
  }
  await applyPulledDocuments(args.collections, json.changes.documents)
  await applyPulledDocumentChunks(args.collections, json.changes.documentChunks)
  await applyPulledGraphSnapshots(args.collections, json.changes.graphSnapshots)
  return json
}

export const syncKnowgrphStorageNow = async (
  args: KnowgrphStorageSyncNowArgs,
): Promise<KnowgrphStorageSyncRunResult> => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) throw new Error('workspaceId is required for knowgrph storage sync')
  const deviceId = normalizeString(args.deviceId) || getKnowgrphStorageDeviceId()
  const inFlightKey = `${workspaceId}::${deviceId}`
  const existingInFlight = inFlightSyncByWorkspace.get(inFlightKey)
  if (existingInFlight) return existingInFlight
  const run = (async (): Promise<KnowgrphStorageSyncRunResult> => {
    const dbState = await getDbState(args.dbState)
    const { collections } = dbState
    const pushBatchSize = normalizePositiveInt(args.pushBatchSize, DEFAULT_PUSH_BATCH_SIZE)
    const maxRetryCount = normalizePositiveInt(args.maxRetryCount, DEFAULT_MAX_RETRY_COUNT)
    const currentCursor = await readCursorRow(collections, workspaceId, deviceId)
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
    return {
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
      lastPushCursor: pushOutcome.ackCursor,
      lastPullCursor: pullResponse.nextCursor || null,
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
      void syncKnowgrphStorageNow({ ...args, workspaceId, deviceId })
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
  const response = await fetchImpl(resolveApiUrl(buildKnowgrphStorageExportPath(workspaceId), args.baseUrl), { method: 'GET' })
  const json = await response.json()
  if (!response.ok || !json || json.ok !== true) {
    throw new Error(`knowgrph storage export failed: ${String((json as { error?: unknown })?.error || 'request failed')}`)
  }
  return json
}
