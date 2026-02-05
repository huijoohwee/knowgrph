import { useCallback, useEffect } from 'react'
import { syncGraphDataToGraphTableDb } from '@/features/graph-table-db/graphTableDb'
import type { GraphData } from '@/lib/graph/types'

type UseGraphTableDbSyncResult = {
  noteGraphWrite: (nextGraphRevision: number) => void
}

let lastSyncedRevisionGlobal = -1
let lastGraphWriteRevisionGlobal: number | null = null

export const useGraphTableDbSync = (
  graphDataRevision: number,
  renderGraphData: GraphData | null | undefined,
): UseGraphTableDbSyncResult => {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (lastGraphWriteRevisionGlobal === graphDataRevision) {
        lastGraphWriteRevisionGlobal = null
        return
      }
      if (lastSyncedRevisionGlobal === graphDataRevision) return
      await syncGraphDataToGraphTableDb(renderGraphData || null)
      if (cancelled) return
      lastSyncedRevisionGlobal = graphDataRevision
    })()
    return () => {
      cancelled = true
    }
  }, [graphDataRevision, renderGraphData])

  const noteGraphWrite = useCallback((nextGraphRevision: number) => {
    lastGraphWriteRevisionGlobal = nextGraphRevision
  }, [])

  return { noteGraphWrite }
}
