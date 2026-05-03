import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import {
  determineLayoutPositions,
  readBaselineDocumentLayoutRuntimeContext,
  readCurrentLayoutHistoryContext,
  readCurrentLayoutPrepContext,
  readCurrentLayoutResolutionContext,
  readCurrentLayoutSeedContext,
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
  isFlowchart: boolean
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
  const currentLayoutPrep = readCurrentLayoutPrepContext({
    graphData: args.sceneGraphData,
    graphDataRevision: args.graphContentRevision || 0,
    schemaLayoutEngineJson: args.schemaLayoutEngineJson,
    frontmatterModeEnabled: !!args.effectiveFrontmatterModeEnabled,
    documentSemanticMode: args.layoutSemanticModeKey,
    graphMetaKey: args.graphMetaKey,
    renderMediaAsNodes: args.renderMediaAsNodes === true,
    mediaPanelDensity: String(args.mediaPanelDensity),
    collapsedGroupIdsKey: args.collapsedGroupIdsKey,
  })
  const layoutViewKey = currentLayoutPrep.layoutViewKey
  const zoomState = pickZoomStateForView({
    zoomViewKey,
    zoomStateByKey: args.zoomStateByKey,
    viewPinned: args.viewPinned,
    fitToScreenMode: args.fitToScreenMode,
    zoomToSelectionMode: args.zoomToSelectionMode,
  })
  const layoutResolutionContext = readCurrentLayoutResolutionContext({
    schema: args.schema,
    semanticMode: args.layoutSemanticModeKey,
    renderMode: args.canvasRenderMode,
    canvas2dRenderer: args.canvas2dRenderer,
  })
  const mode = layoutResolutionContext.mode
  const datasetKey = currentLayoutPrep.datasetKey
  const layoutVariant = args.isFlowchart
    ? `flowchart:v4:${layoutResolutionContext.semanticMode}:${String(args.effectiveFrontmatterModeEnabled ? 1 : 0)}:${String(args.infiniteCanvasInteractionMode)}`
    : ''
  const currentLayoutSeed = readCurrentLayoutSeedContext({
    datasetKey,
    mode,
    frontmatterModeEnabled: !!args.effectiveFrontmatterModeEnabled,
    semanticMode: layoutResolutionContext.semanticMode,
    renderMode: args.canvasRenderMode,
    renderVariant: layoutResolutionContext.renderVariant,
    layoutViewKey,
    nodes: Array.isArray(args.sceneGraphData.nodes) ? args.sceneGraphData.nodes : [],
    layoutPositionCacheByMode: args.layoutPositionCacheByMode,
  })
  const currentLayoutHistory = readCurrentLayoutHistoryContext({
    prevViewKey: args.prevLayoutViewKey,
    prevDatasetKey: args.prevDatasetKey,
    prevMode: args.prevMode,
    prevFrontmatterMode: args.prevFrontmatterMode,
    prevSemanticMode: args.prevSemanticMode,
    prevRenderMode: args.prevRenderMode,
    prevRenderVariant: args.prevRenderVariant,
    prevLayoutVariant: args.prevLayoutVariant,
  })
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
    ...currentLayoutSeed,
    layoutVariant,
    ...currentLayoutHistory,
  })
  const effectiveLayoutPositionsForMode = args.isFlowchart ? null : layoutPositionsForMode

  const baselineLayoutRuntime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: args.documentSemanticMode,
    graphData: args.sceneGraphData,
    fallbackGraphMetaKey: args.graphMetaKey,
    schemaLayoutEngineJson: args.schemaLayoutEngineJson,
    frontmatterModeEnabled: !!args.effectiveFrontmatterModeEnabled,
    renderMediaAsNodes: args.renderMediaAsNodes === true,
    mediaPanelDensity: String(args.mediaPanelDensity),
    collapsedGroupIdsKey: args.collapsedGroupIdsKey,
    datasetKey,
    mode,
    renderMode: args.canvasRenderMode,
    renderVariant: layoutResolutionContext.renderVariant,
    layoutVariant,
    layoutPositionCacheByMode: args.layoutPositionCacheByMode,
    prevSemanticMode: args.prevSemanticMode,
    prevDatasetKey: args.prevDatasetKey,
    prevLayoutViewKey: args.prevLayoutViewKey,
    prevMode: args.prevMode,
    prevFrontmatterMode: args.prevFrontmatterMode,
    prevLayoutVariant: args.prevLayoutVariant,
  })
  const baselineLayoutPositions = baselineLayoutRuntime.baselineLayoutPositions

  const effectiveSkipInitialLayout = args.isFlowchart
    ? false
    : baselineLayoutRuntime.shouldSkipInitialLayoutFromBaselineDocumentPositions
        && args.canvasRenderMode === '2d'
        && String(args.canvas2dRenderer || '') === 'd3'
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
