import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { emitSsotChanged, emitSsotFocusChanged } from 'grph-shared/ssot/events'
import type { SsotSurface } from 'grph-shared/ssot/types'

function surfaceFromSelectionSource(src: unknown): SsotSurface | 'system' {
  if (src === 'table') return 'table'
  if (src === 'canvas') return 'canvas'
  if (src === 'editor') return 'markdown.viewer'
  return 'system'
}

export function SsotEventBridge() {
  React.useEffect(() => {
    const unsubGraph = useGraphStore.subscribe(
      s => [s.graphDataRevision, s.selectionSource, s.graphId] as const,
      next => {
        const revision = next[0]
        const surface = surfaceFromSelectionSource(next[1])
        const graphId = String(next[2] || 'graph')
        emitSsotChanged({
          revision,
          surface,
          reason: 'derive',
          entity: { kind: 'graph', id: graphId },
        })
      },
      { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] },
    )

    const unsubFocus = useGraphStore.subscribe(
      s => [s.selectedNodeId, s.selectedEdgeId, s.selectionSource, s.graphDataRevision] as const,
      next => {
        const selectedNodeId = next[0]
        const selectedEdgeId = next[1]
        const surface = surfaceFromSelectionSource(next[2])
        const graphData = useGraphStore.getState().graphData

        const entity = selectedNodeId
          ? { kind: 'node' as const, id: String(selectedNodeId) }
          : selectedEdgeId
            ? { kind: 'edge' as const, id: String(selectedEdgeId) }
            : null

        const lineRange = (() => {
          if (!graphData || !entity) return null
          if (entity.kind === 'node') {
            const node = graphData.nodes?.find(n => n.id === entity.id)
            const start = Number((node as unknown as { metadata?: unknown })?.metadata && (node as unknown as { metadata?: Record<string, unknown> }).metadata?.lineStart)
            const end = Number((node as unknown as { metadata?: unknown })?.metadata && (node as unknown as { metadata?: Record<string, unknown> }).metadata?.lineEnd)
            if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) return { start, end }
            return null
          }
          const edge = graphData.edges?.find(e => e.id === entity.id)
          const start = Number((edge as unknown as { metadata?: unknown })?.metadata && (edge as unknown as { metadata?: Record<string, unknown> }).metadata?.lineStart)
          const end = Number((edge as unknown as { metadata?: unknown })?.metadata && (edge as unknown as { metadata?: Record<string, unknown> }).metadata?.lineEnd)
          if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) return { start, end }
          return null
        })()

        emitSsotFocusChanged({
          surface: surface === 'system' ? 'canvas' : surface,
          entity,
          lineRange,
        })
      },
      { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] },
    )

    return () => {
      try {
        unsubGraph()
      } catch {
        void 0
      }
      try {
        unsubFocus()
      } catch {
        void 0
      }
    }
  }, [])

  return null
}
