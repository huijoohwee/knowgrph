import { useCallback, useEffect } from 'react'
import { syncGraphDataToGraphTableDb } from '@/features/graph-table-db/graphTableDb'
import type { GraphData } from '@/lib/graph/types'

type UseGraphTableDbSyncResult = {
  noteGraphWrite: (nextGraphRevision: number) => void
}

let lastSyncedKeyGlobal = ''
let lastGraphWriteKeyGlobal: string | null = null

export const useGraphTableDbSync = (
  graphDataRevision: number,
  renderGraphData: GraphData | null | undefined,
  viewKey: string = '',
  enabled: boolean = true,
): UseGraphTableDbSyncResult => {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const key = `${graphDataRevision}:${viewKey}`
      if (lastGraphWriteKeyGlobal === key) {
        lastGraphWriteKeyGlobal = null
        return
      }
      if (lastSyncedKeyGlobal === key) return
      await syncGraphDataToGraphTableDb(renderGraphData || null)
      if (cancelled) return
      lastSyncedKeyGlobal = key
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, graphDataRevision, renderGraphData, viewKey])

  const noteGraphWrite = useCallback((nextGraphRevision: number) => {
    lastGraphWriteKeyGlobal = `${nextGraphRevision}:${viewKey}`
  }, [viewKey])

  return { noteGraphWrite }
}
