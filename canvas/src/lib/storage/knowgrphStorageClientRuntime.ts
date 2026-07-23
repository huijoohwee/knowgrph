import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { getKnowgrphStorageDeviceId } from '@/lib/storage/knowgrphStorageDeviceIdentity'
import {
  buildKnowgrphStorageExportPath,
  buildKnowgrphStorageCursorId,
  buildKnowgrphStoragePullRequest,
  KNOWGRPH_STORAGE_API_VERSION,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
  type KnowgrphStorageExportResponse,
  type KnowgrphStoragePullResponse,
} from '@/lib/storage/knowgrphStorageSyncContract'
import type { KnowgrphStorageDb } from '@/lib/storage/knowgrphStorageDb'
import { KNOWGRPH_STORAGE_SYNC_BOUNDS } from '@/lib/storage/knowgrphStorageBounds'
import type {
  KnowgrphStorageSyncNowArgs,
  KnowgrphStorageSyncRunResult,
} from '@/lib/storage/knowgrphStorageClientTypes'
import {
  DEFAULT_CHUNK_REFERENCE_LIMIT,
  DEFAULT_MAX_RETRY_COUNT,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_PUSH_BATCH_SIZE,
  DEFAULT_SCHEDULE_DELAY_MS,
  KNOWGRPH_STORAGE_SYNC_POLL_PREFIX,
  KNOWGRPH_STORAGE_SYNC_TASK_PREFIX,
  applyPulledDocumentChunks,
  applyPulledDocuments,
  applyPulledGraphSnapshots,
  autoClearStaleOutboxConflicts,
  ensureKnowgrphStorageNumericRepair,
  getDbState,
  inFlightSyncByWorkspace,
  normalizePositiveInt,
  normalizeString,
  pollTimerByWorkspace,
  readCursorRow,
  readUnresolvedConflictCount,
  upsertCursorRow,
} from '@/lib/storage/knowgrphStorageClientSupport'
import {
  KnowgrphStorageRetryableTransportError,
  KnowgrphStorageRetryExhaustedError,
  KnowgrphStorageRouteUnavailableError,
  buildApiOriginKey,
  buildSkippedSyncResult,
  fetchWithTimeout,
  getClientFetch,
  isNetworkLoadFailure,
  isRouteUnavailableForApiOrigin,
  markRouteUnavailableForApiOrigin,
  parseStorageResponseJson,
  resolveKnowgrphStorageApiUrl,
} from '@/lib/storage/knowgrphStorageClientTransport'
import { pushKnowgrphStorageOutbox } from '@/lib/storage/knowgrphStorageClientPush'

export const pullKnowgrphStorageChanges = async (
  args: Required<Pick<KnowgrphStorageSyncNowArgs, 'workspaceId'>> &
    Pick<KnowgrphStorageSyncNowArgs, 'baseUrl' | 'fetchImpl' | 'requestTimeoutMs'> & {
      deviceId: string
      since: string | null
      dbState: KnowgrphStorageDb
    },
) => {
  const fetchImpl = getClientFetch(args.fetchImpl)
  const apiOrigin = buildApiOriginKey(args.baseUrl)
  const chunkRows = await args.dbState.collections.documentChunks
    .find({ selector: { workspaceId: args.workspaceId } })
    .limit(DEFAULT_CHUNK_REFERENCE_LIMIT)
    .exec()
  const knownChunks = chunkRows.map(row => ({
    id: normalizeString(row.get('id')),
    documentId: normalizeString(row.get('documentId')),
    chunkKey: normalizeString(row.get('chunkKey')),
    contentHash: normalizeString(row.get('contentHash')),
  })).filter(chunk => chunk.id && chunk.documentId && chunk.chunkKey && chunk.contentHash)
  const response = await fetchWithTimeout({
    fetchImpl,
    input: resolveKnowgrphStorageApiUrl(KNOWGRPH_STORAGE_ROUTE_PATHS.pull, args.baseUrl),
    timeoutMs: args.requestTimeoutMs,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        buildKnowgrphStoragePullRequest({
          workspaceId: args.workspaceId,
          deviceId: args.deviceId,
          since: args.since,
          knownChunks,
        }),
      ),
    },
  })
  const json = await parseStorageResponseJson<KnowgrphStoragePullResponse | { ok?: false; error?: string }>(response, {
    requestLabel: 'knowgrph storage pull',
    apiOrigin,
  })
  if (!response.ok || !('ok' in json) || json.ok !== true) {
    throw new Error(`knowgrph storage pull failed: ${'error' in json ? String(json.error || 'request failed') : 'request failed'}`)
  }
  const hasChanges =
    json.changes.documents.length > 0
    || json.changes.documentChunks.length > 0
    || json.changes.graphSnapshots.length > 0
  if (!hasChanges) {
    return { response: json, cacheWriteCount: 0, reusedChunkCount: 0 }
  }
  const documentWriteCount = await applyPulledDocuments(args.dbState, json.changes.documents)
  const chunkApply = await applyPulledDocumentChunks(
    args.dbState.collections,
    json.changes.documentChunks,
  )
  const graphWriteCount = await applyPulledGraphSnapshots(
    args.dbState.collections,
    json.changes.graphSnapshots,
  )
  await autoClearStaleOutboxConflicts(
    args.dbState.collections,
    args.workspaceId,
    json.changes.documents,
    json.changes.graphSnapshots,
  )
  return {
    response: json,
    cacheWriteCount: documentWriteCount + chunkApply.writtenCount + graphWriteCount,
    reusedChunkCount: chunkApply.reusedCount,
  }
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
    await ensureKnowgrphStorageNumericRepair(dbState)
    const { collections } = dbState
    const currentCursor = await readCursorRow(collections, workspaceId, deviceId)
    const finishSkippedSync = async (transportError?: string | null) => {
      const result = buildSkippedSyncResult({
        workspaceId,
        deviceId,
        currentCursor,
        unresolvedConflictCount: await readUnresolvedConflictCount(collections, workspaceId),
        transportError,
      })
      if (typeof args.onSyncCompleted === 'function') {
        await args.onSyncCompleted(result)
      }
      return result
    }
    if (isRouteUnavailableForApiOrigin(apiOrigin)) {
      console.warn(`[knowgrph-storage] sync skipped — route unavailable for ${apiOrigin}`)
      return finishSkippedSync(`Storage route is unavailable for ${apiOrigin}.`)
    }
    const pushBatchSize = normalizePositiveInt(args.pushBatchSize, DEFAULT_PUSH_BATCH_SIZE)
    const maxRetryCount = Math.min(
      normalizePositiveInt(args.maxRetryCount, DEFAULT_MAX_RETRY_COUNT),
      KNOWGRPH_STORAGE_SYNC_BOUNDS.maxRetryAttempts,
    )
    try {
      const pushOutcome = await pushKnowgrphStorageOutbox({
        workspaceId,
        deviceId,
        baseUrl: args.baseUrl,
        fetchImpl: args.fetchImpl,
        maxRetryCount,
        pushBatchSize,
        requestTimeoutMs: args.requestTimeoutMs,
        sleepImpl: args.sleepImpl,
        collections,
      })
      const pull = await pullKnowgrphStorageChanges({
        workspaceId,
        deviceId,
        since: normalizeString(currentCursor?.get('lastPullCursor')) || null,
        baseUrl: args.baseUrl,
        fetchImpl: args.fetchImpl,
        requestTimeoutMs: args.requestTimeoutMs,
        dbState,
      })
      const pullResponse = pull.response
      const hasPulledChanges =
        pullResponse.changes.documents.length > 0
        || pullResponse.changes.documentChunks.length > 0
        || pullResponse.changes.graphSnapshots.length > 0
      if (hasPulledChanges && typeof args.onPulledChangesApplied === 'function') {
        await args.onPulledChangesApplied({
          workspaceId,
          deviceId,
          changes: pullResponse.changes,
        })
      }
      if (hasPulledChanges || pushOutcome.ackCursor) {
        const nowMs = Date.now()
        await upsertCursorRow(collections, {
          id: buildKnowgrphStorageCursorId(workspaceId, deviceId),
          workspaceId,
          deviceId,
          lastPullCursor: hasPulledChanges
            ? pullResponse.nextCursor || null
            : normalizeString(currentCursor?.get('lastPullCursor')) || null,
          lastPushCursor: pushOutcome.ackCursor
            || normalizeString(currentCursor?.get('lastPushCursor'))
            || null,
          serverClockMs: Number.isFinite(pullResponse.serverTimeMs)
            ? Math.floor(pullResponse.serverTimeMs)
            : nowMs,
          updatedAtMs: nowMs,
        })
      }
      const result: KnowgrphStorageSyncRunResult = {
        transportStatus: 'synced',
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
        transportError: null,
        lastPushCursor: pushOutcome.ackCursor,
        lastPullCursor: hasPulledChanges
          ? pullResponse.nextCursor || null
          : normalizeString(currentCursor?.get('lastPullCursor')) || null,
      }
      if (typeof args.onSyncCompleted === 'function') {
        await args.onSyncCompleted(result)
      }
      console.log(`[knowgrph-storage] sync ok: pushed=${result.pushedCount} pulled=${result.pulledDocumentCount} reusedChunks=${pull.reusedChunkCount} conflicts=${result.conflictCount} workspace=${workspaceId}`)
      return result
    } catch (error) {
      if (error instanceof KnowgrphStorageRouteUnavailableError) {
        markRouteUnavailableForApiOrigin(error.apiOrigin)
        return finishSkippedSync(error.message)
      }
      if (
        error instanceof KnowgrphStorageRetryableTransportError
        || error instanceof KnowgrphStorageRetryExhaustedError
        || isNetworkLoadFailure(error)
      ) {
        const apiOrigin = buildApiOriginKey(args.baseUrl)
        markRouteUnavailableForApiOrigin(apiOrigin)
        return finishSkippedSync(
          error instanceof Error ? error.message : 'Storage transport failed after bounded retries.',
        )
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
): Promise<KnowgrphStorageExportResponse> => {
  const workspaceId = normalizeString(args.workspaceId)
  if (!workspaceId) throw new Error('workspaceId is required for storage export')
  const fetchImpl = getClientFetch(args.fetchImpl)
  const apiOrigin = buildApiOriginKey(args.baseUrl)
  const response = await fetchImpl(resolveKnowgrphStorageApiUrl(buildKnowgrphStorageExportPath(workspaceId), args.baseUrl), { method: 'GET' })
  const json = await parseStorageResponseJson<KnowgrphStorageExportResponse | { ok?: false; error?: string }>(response, {
    requestLabel: 'knowgrph storage export',
    apiOrigin,
  })
  if (!response.ok || !json || json.ok !== true) {
    throw new Error(`knowgrph storage export failed: ${String((json as { error?: unknown })?.error || 'request failed')}`)
  }
  return json as KnowgrphStorageExportResponse
}
