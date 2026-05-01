import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import {
  buildLayoutPositionCacheKey,
  buildLayoutViewKey,
  computeLayoutDatasetKey,
  determineLayoutPositions,
} from '@/components/GraphCanvas/layout/positioning'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'

export type D3SceneLayoutPrepContext = {
  zoomViewKey: string
  layoutViewKey: string
  mode: ReturnType<typeof readLayoutMode>
  datasetKey: string
  layoutVariant: string
  initialZoomTransform: { k: number; x: number; y: number } | null
  layoutPositionsForMode: ReturnType<typeof determineLayoutPositions>['layoutPositionsForMode']
  effectiveLayoutPositionsForMode: ReturnType<typeof determineLayoutPositions>['layoutPositionsForMode'] | null
  baselineLayoutPositions: Record<string, { x: number; y: number }> | null
  effectiveSkipInitialLayout: boolean
  cacheKey: string
}

export function buildD3SceneLayoutPrepContext(args: {
  sceneGraphData: GraphData
  graphContentRevision: number
  graphDataRevision: number
  graphMetaKey: string
  schema: GraphSchema
  canvasRenderMode: '2d' | '3d'
  canvas2dRenderer: string | null
  schemaLayoutEngineJson: string
  effectiveFrontmatterModeEnabled: boolean
  documentSemanticMode: 'document' | 'keyword'
  layoutSemanticModeKey: string
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  collapsedGroupIdsKey: string
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
  isBipartite: boolean
  infiniteCanvasInteractionMode: string
  sceneWidth: number
  sceneHeight: number
  zoomStateByKey: Parameters<typeof pickZoomStateForView>[0]['zoomStateByKey']
  viewPinned: boolean
  layoutPositionCacheByMode: Parameters<typeof determineLayoutPositions>[0]['layoutPositionCacheByMode']
  lastKnownZoomTransform: { k: number; x: number; y: number } | null
  prevMode: ReturnType<typeof readLayoutMode> | null
  prevFrontmatterMode: boolean | null
  prevSemanticMode: string | null
  prevLayoutVariant: string | null
  prevDatasetKey: string | null
  prevLayoutViewKey: string | null
  prevRenderMode: '2d' | '3d'
  prevRenderVariant: string
}): D3SceneLayoutPrepContext {
  const zoomViewKey = buildZoomViewKey({
    canvasRenderMode: args.canvasRenderMode,
    canvas2dRenderer: args.canvas2dRenderer,
    schemaLayoutEngineJson: args.schemaLayoutEngineJson,
    frontmatterModeEnabled: !!args.effectiveFrontmatterModeEnabled,
    documentSemanticMode: args.layoutSemanticModeKey,
    graphMetaKey: args.graphMetaKey,
    renderMediaAsNodes: args.renderMediaAsNodes === true,
    mediaPanelDensity: String(args.mediaPanelDensity),
    collapsedGroupIdsKey: args.collapsedGroupIdsKey,
  })
  const layoutViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson: args.schemaLayoutEngineJson,
    frontmatterModeEnabled: !!args.effectiveFrontmatterModeEnabled,
    documentSemanticMode: args.layoutSemanticModeKey,
    graphMetaKey: args.graphMetaKey,
    renderMediaAsNodes: args.renderMediaAsNodes === true,
    mediaPanelDensity: String(args.mediaPanelDensity),
    collapsedGroupIdsKey: args.collapsedGroupIdsKey,
  })
  const zoomState = pickZoomStateForView({
    zoomViewKey,
    zoomStateByKey: args.zoomStateByKey,
    viewPinned: args.viewPinned,
    fitToScreenMode: args.fitToScreenMode,
    zoomToSelectionMode: args.zoomToSelectionMode,
  })
  const mode = readLayoutMode(args.schema)
  const datasetKey = computeLayoutDatasetKey({
    graphData: args.sceneGraphData,
    graphDataRevision: args.graphContentRevision || 0,
  })
  const layoutVariant = args.isBipartite
    ? `bipartite:v4:${args.layoutSemanticModeKey}:${String(args.effectiveFrontmatterModeEnabled ? 1 : 0)}:${String(args.infiniteCanvasInteractionMode)}`
    : ''
  const pickedInitialZoomTransform = pickInitialZoomTransform({
    zoomState,
    pinned: args.viewPinned,
    graphDataRevision: args.graphDataRevision,
    nextViewportW: args.sceneWidth,
    nextViewportH: args.sceneHeight,
  })
  const initialZoomTransform =
    pickedInitialZoomTransform || (!args.fitToScreenMode && !args.zoomToSelectionMode ? args.lastKnownZoomTransform : null)
  const { layoutPositionsForMode, skipInitialLayout, cacheKey } = determineLayoutPositions({
    datasetKey,
    mode,
    frontmatterMode: !!args.effectiveFrontmatterModeEnabled,
    semanticMode: args.layoutSemanticModeKey,
    renderMode: args.canvasRenderMode,
    renderVariant: args.canvasRenderMode === '2d' ? args.canvas2dRenderer : '',
    layoutVariant,
    viewKey: layoutViewKey,
    prevViewKey: args.prevLayoutViewKey,
    prevDatasetKey: args.prevDatasetKey,
    prevMode: args.prevMode,
    prevFrontmatterMode: args.prevFrontmatterMode,
    prevSemanticMode: args.prevSemanticMode,
    prevRenderMode: args.prevRenderMode,
    prevRenderVariant: args.prevRenderVariant,
    prevLayoutVariant: args.prevLayoutVariant,
    nodes: Array.isArray(args.sceneGraphData.nodes) ? args.sceneGraphData.nodes : [],
    layoutPositionCacheByMode: args.layoutPositionCacheByMode,
  })
  const effectiveLayoutPositionsForMode = args.isBipartite ? null : layoutPositionsForMode

  const baselineLayoutPositions = (() => {
    if (String(args.documentSemanticMode || 'document') !== 'keyword') return null
    if (!args.layoutPositionCacheByMode) return null

    const lookup = (key: string | null): Record<string, { x: number; y: number }> | null => {
      if (!key) return null
      const cached = args.layoutPositionCacheByMode[key] ?? null
      return cached && Object.keys(cached).length > 0 ? cached : null
    }

    if (args.prevSemanticMode === 'document' && args.prevDatasetKey && args.prevLayoutViewKey) {
      const baselineFromPrevKey = buildLayoutPositionCacheKey({
        datasetKey: args.prevDatasetKey,
        mode: args.prevMode ?? mode,
        frontmatterMode: args.prevFrontmatterMode ?? !!args.effectiveFrontmatterModeEnabled,
        semanticMode: 'document',
        renderMode: args.canvasRenderMode,
        viewKey: args.prevLayoutViewKey,
        renderVariant: args.canvasRenderMode === '2d' ? args.canvas2dRenderer : '',
        layoutVariant: args.prevLayoutVariant ?? layoutVariant,
      })
      const found = lookup(baselineFromPrevKey)
      if (found) return found
    }

    const baselineGraphMetaKey = (() => {
      const metadata =
        args.sceneGraphData.metadata && typeof args.sceneGraphData.metadata === 'object' && !Array.isArray(args.sceneGraphData.metadata)
          ? (args.sceneGraphData.metadata as Record<string, unknown>)
          : null
      const raw = metadata && typeof metadata.baselineGraphMetaKey === 'string' ? metadata.baselineGraphMetaKey.trim() : ''
      return raw || args.graphMetaKey
    })()
    const baselineLayoutViewKey = buildLayoutViewKey({
      schemaLayoutEngineJson: args.schemaLayoutEngineJson,
      frontmatterModeEnabled: !!args.effectiveFrontmatterModeEnabled,
      documentSemanticMode: 'document',
      graphMetaKey: baselineGraphMetaKey,
      renderMediaAsNodes: args.renderMediaAsNodes === true,
      mediaPanelDensity: String(args.mediaPanelDensity),
      collapsedGroupIdsKey: args.collapsedGroupIdsKey,
    })
    const baselineFromCurrentKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode,
      frontmatterMode: !!args.effectiveFrontmatterModeEnabled,
      semanticMode: 'document',
      renderMode: args.canvasRenderMode,
      viewKey: baselineLayoutViewKey,
      renderVariant: args.canvasRenderMode === '2d' ? args.canvas2dRenderer : '',
      layoutVariant,
    })
    return lookup(baselineFromCurrentKey)
  })()

  const effectiveSkipInitialLayout = args.isBipartite
    ? false
    : String(args.documentSemanticMode || 'document') === 'keyword'
        && args.canvasRenderMode === '2d'
        && String(args.canvas2dRenderer || '') === 'd3'
        && !!baselineLayoutPositions
      ? true
      : skipInitialLayout

  return {
    zoomViewKey,
    layoutViewKey,
    mode,
    datasetKey,
    layoutVariant,
    initialZoomTransform,
    layoutPositionsForMode,
    effectiveLayoutPositionsForMode,
    baselineLayoutPositions,
    effectiveSkipInitialLayout,
    cacheKey,
  }
}
