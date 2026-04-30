import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import type { GraphData } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/useGraphStore'
import { hasFrontmatterMermaidSeeds, filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { normalizeCollapsedGroupIds } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'
import type { Canvas2dRendererId } from '@/lib/config'
import { containsFrontmatterMermaid } from 'grph-shared/markdown/mermaidInput'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { withActiveDocumentViewMode } from '@/lib/graph/documentViewMode'
import { useActiveGraphData } from './useActiveGraphData.impl'
import { deriveGraphDataForActiveView } from './activeViewGraph'

let mermaidFrontmatterGeometryModulePromise: Promise<typeof import('@/lib/mermaid/mermaidFrontmatterGeometry')> | null = null

const loadMermaidFrontmatterGeometryModule = async () => {
  if (!mermaidFrontmatterGeometryModulePromise) {
    mermaidFrontmatterGeometryModulePromise = import('@/lib/mermaid/mermaidFrontmatterGeometry')
  }
  return mermaidFrontmatterGeometryModulePromise
}

function isFrontmatterFlowGraphData(graphData: GraphData | null | undefined): boolean {
  if (!graphData) return false
  if (String(graphData.context || '').trim() === 'frontmatter-flow') return true
  const meta =
    graphData.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata)
      ? (graphData.metadata as Record<string, unknown>)
      : null
  return String(meta?.kind || '').trim() === 'frontmatter-flow'
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
} as const

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
            collapsedGroupIds: (s.collapsedGroupIds || []) as string[],
            canvasRenderMode: (s.canvasRenderMode || '2d') as '2d' | '3d',
            canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
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

  const collapsedGroupIdsNormalized = React.useMemo(() => {
    return normalizeCollapsedGroupIds(collapsedGroupIds)
  }, [collapsedGroupIds])

  const collapsedGroupIdsKey = React.useMemo(() => {
    if (collapsedGroupIdsNormalized.length === 0) return ''
    return collapsedGroupIdsNormalized.join('|')
  }, [collapsedGroupIdsNormalized])

  const computed = React.useMemo(() => {
    if (!graphData) return null
    const flowchartMode = canvasRenderMode === '2d' && canvas2dRenderer === 'd3Bipartite'
    if (flowchartMode) {
      const hasYamlFrontmatterMermaid = containsFrontmatterMermaid(String(markdownText || ''))
      if (!hasYamlFrontmatterMermaid) return null
      if (isFrontmatterFlowGraphData(graphData)) return graphData
      const source = hasFrontmatterMermaidSeeds(graphData) ? graphData : null
      if (!source) return null
      const flowchartGraphData = withActiveDocumentViewMode(filterGraphToFrontmatterMermaid(source), 'frontmatter')
      if (!collapsedGroupIdsKey) return flowchartGraphData
      return deriveGraphDataWithGroupCollapse({
        graphData: flowchartGraphData,
        collapsedGroupIds: collapsedGroupIdsNormalized,
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
    collapsedGroupIdsKey,
    collapsedGroupIdsNormalized,
    effectiveDocumentSemanticMode,
    effectiveFrontmatterModeEnabled,
    effectiveMultiDimTableModeEnabled,
    graphData,
    markdownText,
    documentStructureBaselineLock,
  ])

  React.useEffect(() => {
    if (!enabled) return
    lastRef.current = computed
  }, [computed, enabled])

  return enabled ? computed : lastRef.current
}
