import React from 'react'
import { useReactFlow } from 'reactflow'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'

export function FlowZoomEffects(args: {
  active: boolean
  zoomViewKey: string
}) {
  const rf = useReactFlow()
  const {
    zoomRequest,
    clearZoomRequest,
    fitToScreenMode,
    zoomToSelectionMode,
    selectedNodeId,
    selectedNodeIds,
    zoomStateByKey,
    zoomState,
  } = useGraphStore(
    useShallow(s => ({
      zoomRequest: s.zoomRequest,
      clearZoomRequest: s.clearZoomRequest,
      fitToScreenMode: s.fitToScreenMode === true,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      zoomStateByKey: s.zoomStateByKey,
      zoomState: s.zoomState,
    })),
  )

  const lastAppliedKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!args.active) return
    if (lastAppliedKeyRef.current === args.zoomViewKey) return
    lastAppliedKeyRef.current = args.zoomViewKey
    const z = zoomStateByKey[args.zoomViewKey] || zoomState
    if (!z) return
    if (!Number.isFinite(z.k) || !Number.isFinite(z.x) || !Number.isFinite(z.y)) return
    try {
      rf.setViewport({ x: z.x, y: z.y, zoom: z.k }, { duration: 0 })
    } catch {
      void 0
    }
  }, [args.active, args.zoomViewKey, rf, zoomStateByKey, zoomState])

  React.useEffect(() => {
    if (!args.active) return
    if (!zoomRequest) return
    const t = zoomRequest.type
    try {
      if (t === 'in') {
        rf.zoomIn({ duration: 120 })
      } else if (t === 'out') {
        rf.zoomOut({ duration: 120 })
      } else if (t === 'fit') {
        rf.fitView({ duration: 220, padding: 0.12 })
      } else if (t === 'reset') {
        rf.fitView({ duration: 220, padding: 0.12 })
      } else if (t === 'selection') {
        const ids = new Set<string>()
        if (selectedNodeId) ids.add(String(selectedNodeId))
        ;(selectedNodeIds || []).forEach(id => ids.add(String(id)))
        const currentNodes = rf.getNodes()
        const targets = currentNodes.filter(n => ids.has(String(n.id)))
        if (targets.length > 0) {
          rf.fitView({ nodes: targets, duration: 220, padding: 0.18 })
        } else {
          rf.fitView({ duration: 220, padding: 0.12 })
        }
      } else if (t === 'transform') {
        const p = zoomRequest.payload
        if (p && typeof p === 'object') {
          const rec = p as { k?: unknown; x?: unknown; y?: unknown }
          const k = typeof rec.k === 'number' ? rec.k : null
          const x = typeof rec.x === 'number' ? rec.x : null
          const y = typeof rec.y === 'number' ? rec.y : null
          if (k != null && x != null && y != null) {
            rf.setViewport({ x, y, zoom: k }, { duration: 0 })
          }
        }
      }
    } catch {
      void 0
    } finally {
      clearZoomRequest()
    }
  }, [args.active, clearZoomRequest, rf, selectedNodeId, selectedNodeIds, zoomRequest])

  React.useEffect(() => {
    if (!args.active) return
    if (fitToScreenMode || zoomToSelectionMode) {
      try {
        rf.fitView({ duration: 220, padding: 0.12 })
      } catch {
        void 0
      }
    }
  }, [args.active, fitToScreenMode, rf, zoomToSelectionMode])

  return null
}
