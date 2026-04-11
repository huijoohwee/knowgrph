import { useCallback, useEffect } from 'react'
import { syncGraphDataToGraphTableDb } from '@/features/graph-table-db/graphTableDb'
import type { GraphData } from '@/lib/graph/types'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_GRAPH_TABLE_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'

type UseGraphTableDbSyncResult = {
  noteGraphWrite: (nextGraphRevision: number) => void
}

type SyncGate = {
  subscriberCount: number
  lastSyncedRevision: number
  lastGraphWriteRevision: number | null
  inFlight: Promise<void> | null
  pendingAfterFlight: boolean
  latestRevision: number
  latestGraphData: GraphData | null
}

const syncGateByViewKey = new Map<string, SyncGate>()

const getSyncGate = (viewKey: string): SyncGate => {
  const existing = syncGateByViewKey.get(viewKey)
  if (existing) return existing
  const next: SyncGate = {
    subscriberCount: 0,
    lastSyncedRevision: -1,
    lastGraphWriteRevision: null,
    inFlight: null,
    pendingAfterFlight: false,
    latestRevision: -1,
    latestGraphData: null,
  }
  syncGateByViewKey.set(viewKey, next)
  return next
}

const toSyncTaskKey = (viewKey: string): string => {
  const key = String(viewKey || '').trim() || 'default'
  return `graph-table:runtime-persistence-sync:${key}`
}

const toSyncScopeKey = (viewKey: string): string => {
  const key = String(viewKey || '').trim() || 'default'
  return `${WORKSPACE_SYNC_SCOPE_GRAPH_TABLE_RUNTIME_PERSISTENCE}:${key}`
}

const scheduleGraphTableSync = (viewKey: string, gate: SyncGate) => {
  const taskKey = toSyncTaskKey(viewKey)
  const revisionSignature = String(gate.latestRevision)
  scheduleWorkspaceSyncTask(taskKey, () => {
    if (gate.subscriberCount < 1) return
    const revision = gate.latestRevision
    if (gate.lastGraphWriteRevision === revision) {
      gate.lastGraphWriteRevision = null
      return
    }
    if (gate.lastSyncedRevision === revision) return
    if (gate.inFlight) {
      gate.pendingAfterFlight = true
      return
    }

    gate.pendingAfterFlight = false
    gate.inFlight = syncGraphDataToGraphTableDb(gate.latestGraphData || null)
      .then(() => {
        gate.lastSyncedRevision = revision
      })
      .catch(() => void 0)
      .finally(() => {
        gate.inFlight = null
        if (gate.subscriberCount < 1) {
          syncGateByViewKey.delete(viewKey)
          return
        }
        if (!gate.pendingAfterFlight) return
        if (gate.latestRevision === gate.lastSyncedRevision) return
        scheduleGraphTableSync(viewKey, gate)
      })
  }, 140, {
    signature: revisionSignature,
    scopeKey: toSyncScopeKey(viewKey),
  })
}

export const useGraphTableDbSync = (
  graphSyncRevision: number,
  renderGraphData: GraphData | null | undefined,
  viewKey: string = '',
  enabled: boolean = true,
): UseGraphTableDbSyncResult => {
  useEffect(() => {
    if (!enabled) return
    const gate = getSyncGate(viewKey)
    gate.subscriberCount += 1
    return () => {
      gate.subscriberCount = Math.max(0, gate.subscriberCount - 1)
      if (gate.subscriberCount > 0) return
      gate.pendingAfterFlight = false
      gate.latestGraphData = null
      cancelWorkspaceSyncTask(toSyncTaskKey(viewKey))
      if (!gate.inFlight) {
        syncGateByViewKey.delete(viewKey)
      }
    }
  }, [enabled, viewKey])

  useEffect(() => {
    if (!enabled) return
    const gate = getSyncGate(viewKey)
    if (gate.subscriberCount < 1) return
    gate.latestRevision = graphSyncRevision
    gate.latestGraphData = renderGraphData || null
    if (gate.lastGraphWriteRevision === graphSyncRevision) {
      gate.lastGraphWriteRevision = null
      return
    }
    if (gate.lastSyncedRevision === graphSyncRevision) return
    scheduleGraphTableSync(viewKey, gate)
  }, [enabled, graphSyncRevision, renderGraphData, viewKey])

  const noteGraphWrite = useCallback((nextGraphRevision: number) => {
    const gate = getSyncGate(viewKey)
    gate.lastGraphWriteRevision = nextGraphRevision
  }, [viewKey])

  return { noteGraphWrite }
}
