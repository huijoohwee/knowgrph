import { useEffect, useRef, type MutableRefObject } from 'react'
import type * as d3 from 'd3'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'

export function usePersistLayoutOnDeactivate2d(args: {
  active: boolean
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  schemaRef: MutableRefObject<GraphSchema>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
}): void {
  const { active, nodesSelRef, schemaRef, sceneGraphDataRef } = args
  const prevActiveRef = useRef<boolean>(active)

  useEffect(() => {
    const prev = prevActiveRef.current
    prevActiveRef.current = active
    if (!prev || active) return
    const sel = nodesSelRef.current
    if (!sel) return

    const positions: Record<string, { x: number; y: number }> = {}
    sel.each((d: GraphNode) => {
      const id = String(d?.id || '').trim()
      const x = (d as unknown as { x?: unknown }).x
      const y = (d as unknown as { y?: unknown }).y
      if (!id) return
      if (typeof x !== 'number' || typeof y !== 'number') return
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      positions[id] = { x, y }
    })
    if (Object.keys(positions).length === 0) return

    const state = useGraphStore.getState()
    const schemaValue = schemaRef.current
    const mode = schemaValue ? readLayoutMode(schemaValue) : 'radial'
    const semanticModeBase = String(state.documentSemanticMode || 'document')
    const semanticModeKey = state.multiDimTableModeEnabled === true ? `${semanticModeBase}:mdtbl` : semanticModeBase
    const graphDataForView = sceneGraphDataRef.current ?? ((state.graphData as unknown as GraphData | null) ?? null)
    const frontmatter = computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: state.frontmatterModeEnabled === true,
      documentSemanticMode: semanticModeBase as 'document' | 'keyword',
      graphData: graphDataForView,
    })
    const datasetKey = computeLayoutDatasetKey({
      graphData: graphDataForView as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null,
      graphDataRevision: state.graphDataRevision || 0,
    })
    const renderVariant = String(state.canvas2dRenderer || 'd3')
    const layoutVariant = renderVariant === 'd3Bipartite'
      ? `bipartite:v4:${semanticModeKey}:${String(frontmatter ? 1 : 0)}:${String(state.infiniteCanvasInteractionMode)}`
      : ''
    const graphMetaKey = buildGraphMetaKeyIgnoringPending(graphDataForView)
    const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(state.collapsedGroupIds)
    const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(schemaValue)
    const viewKey = buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: frontmatter,
      documentSemanticMode: semanticModeKey,
      graphMetaKey,
      renderMediaAsNodes: state.renderMediaAsNodes === true,
      mediaPanelDensity: String(state.mediaPanelDensity),
      collapsedGroupIdsKey,
    })
    const cacheKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode,
      frontmatterMode: frontmatter,
      semanticMode: semanticModeKey,
      renderMode: '2d',
      viewKey,
      renderVariant,
      layoutVariant,
    })

    try {
      state.setLayoutPositionsForMode(cacheKey, positions)
    } catch {
      void 0
    }
  }, [active, nodesSelRef, schemaRef, sceneGraphDataRef])
}
