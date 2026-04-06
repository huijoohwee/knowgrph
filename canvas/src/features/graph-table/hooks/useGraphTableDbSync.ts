import { useCallback, useEffect } from 'react'
import { syncGraphDataToGraphTableDb } from '@/features/graph-table-db/graphTableDb'
import type { GraphData } from '@/lib/graph/types'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'

type UseGraphTableDbSyncResult = {
  noteGraphWrite: (nextGraphRevision: number) => void
}

type SyncGate = {
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

const scheduleGraphTableSync = (viewKey: string, gate: SyncGate) => {
  const taskKey = toSyncTaskKey(viewKey)
  const revisionSignature = String(gate.latestRevision)
  scheduleWorkspaceSyncTask(taskKey, () => {
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
        if (!gate.pendingAfterFlight) return
        if (gate.latestRevision === gate.lastSyncedRevision) return
        scheduleGraphTableSync(viewKey, gate)
      })
  }, 140, { signature: revisionSignature })
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
    gate.latestRevision = graphSyncRevision
    gate.latestGraphData = renderGraphData || null
    if (gate.lastGraphWriteRevision === graphSyncRevision) {
      gate.lastGraphWriteRevision = null
      return
    }
    if (gate.lastSyncedRevision === graphSyncRevision) return
    scheduleGraphTableSync(viewKey, gate)
    return () => {
      cancelWorkspaceSyncTask(toSyncTaskKey(viewKey))
    }
  }, [enabled, graphSyncRevision, renderGraphData, viewKey])

  const noteGraphWrite = useCallback((nextGraphRevision: number) => {
    const gate = getSyncGate(viewKey)
    gate.lastGraphWriteRevision = nextGraphRevision
  }, [viewKey])

  return { noteGraphWrite }
}
