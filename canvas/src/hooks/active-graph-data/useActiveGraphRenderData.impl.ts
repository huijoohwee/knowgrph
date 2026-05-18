import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import type { GraphData } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/useGraphStore'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import type { Canvas2dRendererId } from '@/lib/config'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { applyCanvasRenderBudget, resolveCanvasRenderBudgetSurface } from '@/lib/graph/canvasRenderBudget'
import { withGraphTopologyMetadata } from '@/lib/graph/graphTopology'
import { useActiveGraphData } from './useActiveGraphData.impl'
import { deriveFlowchartFrontmatterActiveViewGraph, deriveGraphDataForActiveView } from './activeViewGraph'

let mermaidFrontmatterGeometryModulePromise: Promise<typeof import('@/lib/mermaid/mermaidFrontmatterGeometry')> | null = null

const loadMermaidFrontmatterGeometryModule = async () => {
  if (!mermaidFrontmatterGeometryModulePromise) {
    mermaidFrontmatterGeometryModulePromise = import('@/lib/mermaid/mermaidFrontmatterGeometry')
  }
  return mermaidFrontmatterGeometryModulePromise
}

const INACTIVE_RENDER_SLICE = {
  frontmatterModeEnabled: false,
  multiDimTableModeEnabled: false,
  documentSemanticMode: 'document',
  documentStructureBaselineLock: false,
  markdownText: null as string | null,
  collapsedGroupIds: [] as string[],
  canvasRenderMode: '2d' as '2d' | '3d',
  canvas2dRenderer: 'd3' as Canvas2dRendererId,
  graphDataRevision: 0,
} as const

const EMPTY_STRING_ARRAY: string[] = []

export function useActiveGraphRenderData(enabled: boolean = true): GraphData | null {
  const graphData = useActiveGraphData(enabled)

  const selector = React.useMemo(
    () =>
      enabled
        ? (s: GraphState) => ({
            frontmatterModeEnabled: s.frontmatterModeEnabled === true,
            multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
            documentSemanticMode: String(s.documentSemanticMode || 'document'),
            documentStructureBaselineLock: s.documentStructureBaselineLock === true,
            markdownText: s.markdownDocumentText || null,
            collapsedGroupIds: (s.collapsedGroupIds ?? EMPTY_STRING_ARRAY) as string[],
            canvasRenderMode: (s.canvasRenderMode || '2d') as '2d' | '3d',
            canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
            graphDataRevision: typeof s.graphDataRevision === 'number' ? s.graphDataRevision : 0,
          })
        : () => INACTIVE_RENDER_SLICE,
    [enabled],
  )

  const {
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentSemanticMode,
    documentStructureBaselineLock,
    markdownText,
    collapsedGroupIds,
    canvasRenderMode,
    canvas2dRenderer,
    graphDataRevision,
  } = useGraphStore(useShallow(selector))
  const frontmatterOnlyPolicyActive = React.useMemo(
    () => isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer }),
    [canvasRenderMode, canvas2dRenderer],
  )
  const effectiveDocumentSemanticMode = frontmatterOnlyPolicyActive ? 'document' : documentSemanticMode
  const effectiveFrontmatterModeEnabled = frontmatterOnlyPolicyActive ? true : frontmatterModeEnabled
  const effectiveMultiDimTableModeEnabled = frontmatterOnlyPolicyActive ? false : multiDimTableModeEnabled

  const applyMermaidGeometryAttemptKeyRef = React.useRef<string>('')
  const applyMermaidGeometryInFlightRef = React.useRef(false)
  React.useEffect(() => {
    if (!enabled) return
    if (!effectiveFrontmatterModeEnabled) return
    if (String(effectiveDocumentSemanticMode || 'document') !== 'document') return
    const base = graphData
    if (!base) return
    if (String((base as unknown as { context?: unknown }).context || '') === 'frontmatter-mermaid') return
    const meta =
      base.metadata && typeof base.metadata === 'object' && !Array.isArray(base.metadata)
        ? (base.metadata as Record<string, unknown>)
        : null
    if (meta && String(meta.layoutEngine || '') === 'mermaid') return
    if (!computeEffectiveFrontmatterMode({ frontmatterModeEnabled: true, documentSemanticMode: effectiveDocumentSemanticMode, graphData: base })) return
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const attemptKey = `mermaidGeom:${buildGraphMetaKey(base)}:${base.nodes?.length || 0}:${base.edges?.length || 0}`
    if (applyMermaidGeometryAttemptKeyRef.current === attemptKey) return
    applyMermaidGeometryAttemptKeyRef.current = attemptKey
    if (applyMermaidGeometryInFlightRef.current) return
    applyMermaidGeometryInFlightRef.current = true

    let cancelled = false
    ;(async () => {
      try {
        const { applyMermaidFrontmatterGeometryToGraphData } = await loadMermaidFrontmatterGeometryModule()
        if (cancelled) return
        const updated = await applyMermaidFrontmatterGeometryToGraphData(base)
        if (cancelled) return
        if (!updated || updated === base) return
        if (String((updated as unknown as { context?: unknown }).context || '') !== 'frontmatter-mermaid') return
        useGraphStore.getState().setGraphDataPreservingLayout(updated)
      } catch {
        void 0
      } finally {
        applyMermaidGeometryInFlightRef.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [effectiveDocumentSemanticMode, effectiveFrontmatterModeEnabled, enabled, graphData])

  const lastRef = React.useRef<GraphData | null>(null)

  const computed = React.useMemo(() => {
    if (!graphData) return null
    const flowchartMode = canvasRenderMode === '2d' && canvas2dRenderer === 'flowchart'
    if (flowchartMode) {
      return deriveFlowchartFrontmatterActiveViewGraph({
        graphData,
        markdownText,
      })
    }
    return deriveGraphDataForActiveView({
      graphData,
      frontmatterModeEnabled: effectiveFrontmatterModeEnabled,
      multiDimTableModeEnabled: effectiveMultiDimTableModeEnabled,
      documentSemanticMode: effectiveDocumentSemanticMode,
      documentStructureBaselineLock,
      collapsedGroupIds,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIds,
    effectiveDocumentSemanticMode,
    effectiveFrontmatterModeEnabled,
    effectiveMultiDimTableModeEnabled,
    graphData,
    markdownText,
    documentStructureBaselineLock,
  ])

  const budgetSurface = React.useMemo(
    () => resolveCanvasRenderBudgetSurface({ canvasRenderMode, canvas2dRenderer }),
    [canvas2dRenderer, canvasRenderMode],
  )
  const topologyComputed = React.useMemo(() => {
    return withGraphTopologyMetadata({
      graphData: computed,
      graphRevision: graphDataRevision,
      stage: 'active-view',
      annotate: true,
    })
  }, [computed, graphDataRevision])

  const budgetedComputed = React.useMemo(() => {
    return applyCanvasRenderBudget({
      graphData: topologyComputed,
      graphRevision: graphDataRevision,
      surface: budgetSurface,
      documentSemanticMode: effectiveDocumentSemanticMode,
    })
  }, [budgetSurface, effectiveDocumentSemanticMode, graphDataRevision, topologyComputed])

  const renderComputed = React.useMemo(() => {
    return withGraphTopologyMetadata({
      graphData: budgetedComputed,
      graphRevision: graphDataRevision,
      stage: 'render',
      annotate: true,
    })
  }, [budgetedComputed, graphDataRevision])

  React.useEffect(() => {
    if (!enabled) return
    lastRef.current = renderComputed
  }, [enabled, renderComputed])

  return enabled ? renderComputed : lastRef.current
}
