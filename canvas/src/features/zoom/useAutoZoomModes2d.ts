import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { useGraphStore } from '@/hooks/useGraphStore'
import { shouldAutoFitToScreen2d, shouldAutoZoomSelection2d } from '@/features/zoom/autoZoom2dPolicy'
import type { GraphData } from '@/lib/graph/types'

export function useAutoZoomModes2d(args: {
  viewportW: number
  viewportH: number
  paused?: boolean
  getGraph?: () => { graphData: GraphData | null; graphDataRevision: number } | null
}) {
  const scheduleFitRef = React.useRef<(() => void) | null>(null)
  const dimsRef = React.useRef({ viewportW: args.viewportW, viewportH: args.viewportH })
  React.useEffect(() => {
    dimsRef.current = { viewportW: args.viewportW, viewportH: args.viewportH }
    const schedule = scheduleFitRef.current
    if (schedule) schedule()
  }, [args.viewportH, args.viewportW])

  const pausedRef = React.useRef<boolean>(!!args.paused)
  React.useEffect(() => {
    pausedRef.current = !!args.paused
  }, [args.paused])

  const lastFitSigRef = React.useRef<string | null>(null)
  const lastAutoZoomSelRef = React.useRef<string | null>(null)
  const graphOverrideRef = React.useRef<(() => { graphData: GraphData | null; graphDataRevision: number } | null) | null>(null)
  React.useEffect(() => {
    graphOverrideRef.current = typeof args.getGraph === 'function' ? args.getGraph : null
    const schedule = scheduleFitRef.current
    if (schedule) schedule()
  }, [args.getGraph])

  React.useEffect(() => {
    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (pausedRef.current) return
        const state = useGraphStore.getState()
        if (
          !shouldAutoFitToScreen2d({
            canvas2dRenderer: String(state.canvas2dRenderer || ''),
            viewPinned: state.viewPinned === true,
            fitToScreenMode: state.fitToScreenMode === true,
            zoomToSelectionMode: state.zoomToSelectionMode === true,
          })
        ) {
          lastFitSigRef.current = null
          return
        }
        const override = graphOverrideRef.current ? graphOverrideRef.current() : null
        const graphData = override?.graphData ?? state.graphData
        const graphDataRevision = override?.graphDataRevision ?? state.graphDataRevision
        const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
        if (nodes.length === 0) return
        const panelDims = {
          width: Math.max(1, Math.floor(dimsRef.current.viewportW)),
          height: Math.max(1, Math.floor(dimsRef.current.viewportH)),
        }
        const schema = state.schema as GraphSchema | null
        const [minScale, maxScale] = schema ? readZoomScaleExtent(schema) : [0.1, 4]
        const fitSig = schema
          ? `${String(schema.layout?.fitPadding ?? '')}|${String(schema.layout?.fitDetectClusters ?? '')}|${String(
              schema.layout?.fitTargetAspectRatio ?? '',
            )}|${String(schema.layout?.fitEnforceAspectRatio ?? '')}|${minScale}|${maxScale}|${String(state.mediaPanelDensity ?? '')}|${String(
              state.renderMediaAsNodes ? 1 : 0,
            )}`
          : `${minScale}|${maxScale}|${String(state.mediaPanelDensity ?? '')}|${String(state.renderMediaAsNodes ? 1 : 0)}`
        const sig = `${nodes.length}|${panelDims.width}x${panelDims.height}|${graphDataRevision}|${fitSig}`
        if (lastFitSigRef.current === sig) return
        lastFitSigRef.current = sig
        state.requestZoom('fit', { intent: 'fitToScreen' })
      })
    }
    scheduleFitRef.current = schedule
    schedule()
    const unsub = useGraphStore.subscribe(
      s => ({
        canvas2dRenderer: s.canvas2dRenderer,
        fitToScreenMode: s.fitToScreenMode,
        zoomToSelectionMode: s.zoomToSelectionMode,
        viewPinned: s.viewPinned,
        graphDataRevision: s.graphDataRevision,
        graphNodeCount: Array.isArray(s.graphData?.nodes) ? s.graphData.nodes.length : 0,
        fitPadding: s.schema?.layout?.fitPadding,
        fitDetectClusters: s.schema?.layout?.fitDetectClusters,
        fitTargetAspectRatio: s.schema?.layout?.fitTargetAspectRatio,
        fitEnforceAspectRatio: s.schema?.layout?.fitEnforceAspectRatio,
        zoomMinScale: s.schema?.performance?.zoom?.minScale,
        zoomMaxScale: s.schema?.performance?.zoom?.maxScale,
        mediaPanelDensity: s.mediaPanelDensity,
        renderMediaAsNodes: s.renderMediaAsNodes,
      }),
      () => schedule(),
    )
    return () => {
      unsub()
      scheduleFitRef.current = null
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])

  React.useEffect(() => {
    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (pausedRef.current) return
        const state = useGraphStore.getState()
        if (
          !shouldAutoZoomSelection2d({
            canvas2dRenderer: String(state.canvas2dRenderer || ''),
            viewPinned: state.viewPinned === true,
            zoomToSelectionMode: state.zoomToSelectionMode === true,
          })
        ) {
          lastAutoZoomSelRef.current = null
          return
        }
        const schema = state.schema as GraphSchema | null
        const expansionCfg = schema?.behavior?.expansion || {}
        const expansionEnabled = expansionCfg.enabled !== false
        const zoomOnSelection = expansionEnabled && expansionCfg.zoomOnSelection !== false
        if (!zoomOnSelection) return
        const override = graphOverrideRef.current ? graphOverrideRef.current() : null
        const graphDataRevision = override?.graphDataRevision ?? state.graphDataRevision
        const nodeIds =
          Array.isArray(state.selectedNodeIds) && state.selectedNodeIds.length > 0
            ? state.selectedNodeIds
            : state.selectedNodeId
              ? [state.selectedNodeId]
              : []
        const edgeIds =
          Array.isArray(state.selectedEdgeIds) && state.selectedEdgeIds.length > 0
            ? state.selectedEdgeIds
            : state.selectedEdgeId
              ? [state.selectedEdgeId]
              : []
        const groupIds =
          Array.isArray(state.selectedGroupIds) && state.selectedGroupIds.length > 0
            ? state.selectedGroupIds
            : state.selectedGroupId
              ? [state.selectedGroupId]
              : []
        if (nodeIds.length === 0 && edgeIds.length === 0 && groupIds.length === 0) return
        const key = `${nodeIds.join(',')}|${edgeIds.join(',')}|${groupIds.join(',')}|${graphDataRevision}`
        if (lastAutoZoomSelRef.current === key) return
        lastAutoZoomSelRef.current = key
        state.requestZoom('selection')
      })
    }
    const unsub = useGraphStore.subscribe(
      s => ({
        canvas2dRenderer: s.canvas2dRenderer,
        zoomToSelectionMode: s.zoomToSelectionMode,
        selectedNodeId: s.selectedNodeId,
        selectedEdgeId: s.selectedEdgeId,
        selectedGroupId: s.selectedGroupId,
        selectedNodeIds: s.selectedNodeIds,
        selectedEdgeIds: s.selectedEdgeIds,
        selectedGroupIds: s.selectedGroupIds,
        graphDataRevision: s.graphDataRevision,
        viewPinned: s.viewPinned,
      }),
      () => schedule(),
    )
    return () => {
      unsub()
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])
}
