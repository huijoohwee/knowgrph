import { useCallback, useEffect } from 'react'
import { syncGraphDataToGraphTableDb } from '@/features/graph-table-db/graphTableDb'
import type { GraphData } from '@/lib/graph/types'

type UseGraphTableDbSyncResult = {
  noteGraphWrite: (nextGraphRevision: number) => void
}

type SyncGate = {
  lastSyncedRevision: number
  lastGraphWriteRevision: number | null
  scheduledTimer: ReturnType<typeof setTimeout> | null
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
    scheduledTimer: null,
    inFlight: null,
    pendingAfterFlight: false,
    latestRevision: -1,
    latestGraphData: null,
  }
  syncGateByViewKey.set(viewKey, next)
  return next
}

const scheduleGraphTableSync = (gate: SyncGate) => {
  if (gate.scheduledTimer) {
    try {
      clearTimeout(gate.scheduledTimer)
    } catch {
      void 0
    }
    gate.scheduledTimer = null
  }

  gate.scheduledTimer = setTimeout(() => {
    gate.scheduledTimer = null
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
        scheduleGraphTableSync(gate)
      })
  }, 140)
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
    scheduleGraphTableSync(gate)
  }, [enabled, graphSyncRevision, renderGraphData, viewKey])

  const noteGraphWrite = useCallback((nextGraphRevision: number) => {
    const gate = getSyncGate(viewKey)
    gate.lastGraphWriteRevision = nextGraphRevision
  }, [viewKey])

  return { noteGraphWrite }
}
