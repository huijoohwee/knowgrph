import {
  buildLayoutPositionCacheKey,
  buildLayoutViewKey,
  determineLayoutPositions,
  readBaselineDocumentLayoutRuntimeContext,
  readCurrentLayoutHistoryContext,
  readCurrentLayoutPrepContext,
  readCurrentLayoutResolutionContext,
  readCurrentLayoutSeedContext,
} from '@/components/GraphCanvas/layout/positioning'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export const testLayoutPositioningSkipsReseedOnToggle = () => {
  const datasetKey = 'graphId:test'
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const resNoCache = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevViewKey: null,
    prevDatasetKey: datasetKey,
    prevMode: 'force',
    prevFrontmatterMode: true,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    prevRenderVariant: 'd3',
    nodes,
    layoutPositionCacheByMode: {},
  })
  if (resNoCache.skipInitialLayout !== true) {
    throw new Error('expected force layout to skip initial layout when nodes already have positions')
  }
  if (resNoCache.layoutPositionsForMode !== null) {
    throw new Error('expected no cache positions when cache is empty')
  }

  const key = `${datasetKey}:document:default:force:2d:d3`
  const cache = {
    [key]: {
      a: { x: 1, y: 2 },
      b: { x: 3, y: 4 },
    },
  }
  const resWithCache = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevViewKey: null,
    prevDatasetKey: datasetKey,
    prevMode: 'force',
    prevFrontmatterMode: true,
    prevSemanticMode: 'document',
    prevRenderMode: '3d',
    prevRenderVariant: '',
    nodes,
    layoutPositionCacheByMode: cache,
  })
  if (resWithCache.cacheKey !== key) {
    throw new Error(`expected cacheKey ${key}, got ${resWithCache.cacheKey}`)
  }
  if (!resWithCache.layoutPositionsForMode) {
    throw new Error('expected cache positions to be selected on view toggle when coverage is high')
  }
  if (resWithCache.skipInitialLayout !== true) {
    throw new Error('expected cached force layout to skip initial layout')
  }
}

export const testLayoutPositioningCacheKeyUsesRenderVariant = () => {
  const datasetKey = 'graphId:test'
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const d3 = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevViewKey: null,
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  })

  const flow = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'flow',
    prevViewKey: null,
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  })

  if (d3.cacheKey !== `${datasetKey}:document:default:force:2d:d3`) {
    throw new Error(`expected d3 cacheKey ${datasetKey}:document:default:force:2d:d3, got ${d3.cacheKey}`)
  }
  if (flow.cacheKey !== `${datasetKey}:document:default:force:2d:flow`) {
    throw new Error(`expected flow cacheKey ${datasetKey}:document:default:force:2d:flow, got ${flow.cacheKey}`)
  }
  if (String(d3.cacheKey) === String(flow.cacheKey)) {
    throw new Error('expected 2d cache keys to differ by renderVariant')
  }
}

export const testLayoutPositioningCacheKeyUsesRenderVariantFor3d = () => {
  const datasetKey = 'graphId:test'
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
  ]

  const threeA = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '3d',
    renderVariant: 'three',
    prevViewKey: null,
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  })
  const threeB = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '3d',
    renderVariant: 'three:alt',
    prevViewKey: null,
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  })

  if (threeA.cacheKey === threeB.cacheKey) throw new Error('expected 3d cache keys to differ by renderVariant')
}

export const testLayoutPositioningForcesLayoutWhenVariantChanges = () => {
  const datasetKey = 'graphId:test'
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const res = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: 'variant:a',
    prevViewKey: null,
    prevDatasetKey: datasetKey,
    prevMode: 'force',
    prevFrontmatterMode: false,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    prevRenderVariant: 'd3',
    prevLayoutVariant: 'variant:b',
    nodes,
    layoutPositionCacheByMode: {},
  })

  if (res.skipInitialLayout !== false) {
    throw new Error('expected variant change to force initial layout when no cache exists')
  }
}

export const testLayoutPositioningDoesNotReuseCacheAcrossDatasets = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', properties: {} },
    { id: 'b', label: 'b', type: 'T', properties: {} },
  ]

  const dsA = 'graphId:a'
  const dsB = 'graphId:b'
  const keyA = `${dsA}:document:default:force:2d:d3`
  const keyB = `${dsB}:document:default:force:2d:d3`

  const cache = {
    [keyA]: {
      a: { x: 1, y: 2 },
      b: { x: 3, y: 4 },
    },
  }

  const res = determineLayoutPositions({
    datasetKey: dsB,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevViewKey: null,
    prevDatasetKey: dsA,
    prevMode: 'force',
    prevFrontmatterMode: false,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    nodes,
    layoutPositionCacheByMode: cache,
  })

  if (res.cacheKey !== keyB) {
    throw new Error(`expected cacheKey ${keyB}, got ${res.cacheKey}`)
  }
  if (res.layoutPositionsForMode !== null) {
    throw new Error('expected cache not to be reused across dataset keys')
  }
}

export const testLayoutPositioningReusesCacheAcross2dRenderers = () => {
  const datasetKey = 'graphId:test'
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', properties: {} },
    { id: 'b', label: 'b', type: 'T', properties: {} },
  ]

  const base = `${datasetKey}:document:default:force:2d`
  const flowKey = `${base}:flow`
  const cache = {
    [flowKey]: {
      a: { x: 10, y: 20 },
      b: { x: 30, y: 40 },
    },
  }

  const d3 = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevViewKey: null,
    prevDatasetKey: datasetKey,
    prevMode: 'force',
    prevFrontmatterMode: false,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    prevRenderVariant: 'flow',
    nodes,
    layoutPositionCacheByMode: cache,
  })

  if (!d3.layoutPositionsForMode) {
    throw new Error('expected D3 to reuse cached positions from other 2D renderer')
  }
  if (d3.layoutPositionsForMode.a.x !== 10 || d3.layoutPositionsForMode.b.y !== 40) {
    throw new Error('expected D3 to pick flow cached positions')
  }
}

export const testLayoutPositioningCacheKeyIncludesViewKey = () => {
  const datasetKey = 'graphId:test'
  const base = {
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'markdown:local',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  } as const
  const viewA = buildLayoutViewKey(base)
  const viewB = buildLayoutViewKey({ ...base, collapsedGroupIdsKey: 'community:0' })

  const keyA = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: viewA,
  })
  const keyB = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: viewB,
  })
  if (keyA === keyB) throw new Error('expected layout cache key to change when view key changes')
  if (!keyA.includes(':v=') || !keyB.includes(':v=')) {
    throw new Error('expected layout cache key to include view hash segment')
  }
}

export const testLayoutPositioningCacheKeyIsolatesMediaDensity = () => {
  const datasetKey = 'graphId:test'
  const base = {
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'markdown:local',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  } as const
  const viewDefault = buildLayoutViewKey(base)
  const viewCompact = buildLayoutViewKey({ ...base, mediaPanelDensity: 'compact' })

  const keyDefault = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: viewDefault,
  })
  const keyCompact = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: viewCompact,
  })
  if (keyDefault === keyCompact) {
    throw new Error('expected layout cache key to differ between media densities')
  }
}

export const testLayoutPositioningCacheKeyIsolatesRenderMediaAsNodes = () => {
  const datasetKey = 'graphId:test'
  const base = {
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'markdown:local',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  } as const
  const viewOn = buildLayoutViewKey(base)
  const viewOff = buildLayoutViewKey({ ...base, renderMediaAsNodes: false })

  const keyOn = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: viewOn,
  })
  const keyOff = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: viewOff,
  })
  if (keyOn === keyOff) {
    throw new Error('expected layout cache key to differ between renderMediaAsNodes states')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextUsesCurrentBaselineGraphMetaKeyOverride = () => {
  const datasetKey = 'graphId:test'
  const baselineGraphData: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: { baselineGraphMetaKey: 'baseline:doc:1' },
    nodes: [],
    edges: [],
  }
  const baselineViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'baseline:doc:1',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  })
  const baselineKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: baselineViewKey,
    renderVariant: 'd3',
  })
  const baselinePositions = {
    a: { x: 11, y: 22 },
    b: { x: 33, y: 44 },
  }

  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'keyword',
    graphData: baselineGraphData,
    fallbackGraphMetaKey: 'current:keyword:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey,
    mode: 'force',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: '',
    layoutPositionCacheByMode: {
      [baselineKey]: baselinePositions,
    },
  })

  if (runtime.baselineLayoutPositions !== baselinePositions) {
    throw new Error('expected baseline layout runtime context to reuse the baseline graph meta key override cache entry')
  }
}

export const testReadCurrentLayoutPrepContextReturnsDatasetAndViewKeys = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: {},
    nodes: [{ id: 'a', type: 'note' } as any],
    edges: [],
  }
  const expectedViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'keyword',
    graphMetaKey: 'graph:meta:1',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  })

  const context = readCurrentLayoutPrepContext({
    graphData,
    graphDataRevision: 7.9,
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'keyword',
    graphMetaKey: 'graph:meta:1',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  })

  if (context.layoutViewKey !== expectedViewKey) {
    throw new Error('expected current layout prep context to derive the shared layout view key')
  }
  if (!context.datasetKey || typeof context.datasetKey !== 'string') {
    throw new Error('expected current layout prep context to derive a dataset key')
  }
}

export const testReadCurrentLayoutResolutionContextReturnsModeSemanticModeAndRenderVariant = () => {
  const schema = {
    type: 'GraphSchema',
    layout: { mode: 'force' },
  } as any
  const context = readCurrentLayoutResolutionContext({
    schema,
    semanticMode: ' keyword ',
    renderMode: '2d',
    canvas2dRenderer: '',
    default2dRenderVariant: 'd3',
  })

  if (context.mode !== readLayoutMode(schema)) {
    throw new Error('expected current layout resolution context to derive the shared layout mode')
  }
  if (context.semanticMode !== ' keyword ') {
    throw new Error('expected current layout resolution context to preserve the provided semantic mode string contract')
  }
  if (context.renderVariant !== 'd3') {
    throw new Error('expected current layout resolution context to derive the shared 2d render variant fallback')
  }
}

export const testReadCurrentLayoutSeedContextReturnsCommonDetermineLayoutPositionsArgs = () => {
  const nodes = [{ id: 'a', type: 'note' } as any]
  const seed = readCurrentLayoutSeedContext({
    datasetKey: 'graphId:test',
    mode: 'force',
    frontmatterModeEnabled: true,
    semanticMode: 'keyword',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutViewKey: 'view:key',
    nodes,
    layoutPositionCacheByMode: null,
  })

  if (seed.datasetKey !== 'graphId:test' || seed.mode !== 'force') {
    throw new Error('expected current layout seed context to preserve dataset key and mode')
  }
  if (seed.frontmatterMode !== true || seed.semanticMode !== 'keyword') {
    throw new Error('expected current layout seed context to preserve frontmatter and semantic mode')
  }
  if (seed.renderMode !== '2d' || seed.renderVariant !== 'd3') {
    throw new Error('expected current layout seed context to preserve render mode and render variant')
  }
  if (seed.viewKey !== 'view:key' || seed.nodes !== nodes) {
    throw new Error('expected current layout seed context to preserve view key and nodes')
  }
  if (seed.layoutPositionCacheByMode !== null) {
    throw new Error('expected current layout seed context to normalize missing layout cache to null')
  }
}

export const testReadCurrentLayoutHistoryContextNormalizesPreviousDetermineLayoutPositionsArgs = () => {
  const history = readCurrentLayoutHistoryContext({
    prevDatasetKey: 'graphId:test',
    prevMode: 'force',
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    prevRenderVariant: 'd3',
  })

  if (history.prevDatasetKey !== 'graphId:test' || history.prevMode !== 'force') {
    throw new Error('expected current layout history context to preserve previous dataset key and mode')
  }
  if (history.prevSemanticMode !== 'document' || history.prevRenderMode !== '2d') {
    throw new Error('expected current layout history context to preserve previous semantic and render mode')
  }
  if (history.prevRenderVariant !== 'd3') {
    throw new Error('expected current layout history context to preserve previous render variant')
  }
  if (history.prevViewKey !== null || history.prevFrontmatterMode !== null || history.prevLayoutVariant !== null) {
    throw new Error('expected current layout history context to normalize missing previous layout fields to null')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextRejectsEmptyCurrentBaselineCacheEntry = () => {
  const datasetKey = 'graphId:test'
  const baselineViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'graph:doc:1',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  })
  const baselineKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: baselineViewKey,
    renderVariant: 'd3',
  })

  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'keyword',
    graphData: null,
    fallbackGraphMetaKey: 'graph:doc:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey,
    mode: 'force',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: '',
    layoutPositionCacheByMode: {
      [baselineKey]: {},
    },
  })

  if (runtime.baselineLayoutPositions !== null) {
    throw new Error('expected baseline layout runtime context to ignore empty current baseline cache entries')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextUsesPreviousDocumentCacheKey = () => {
  const datasetKey = 'graphId:test'
  const baselineKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: 'view:prev',
    renderVariant: 'd3',
    layoutVariant: '',
  })
  const baselinePositions = {
    a: { x: 7, y: 8 },
    b: { x: 9, y: 10 },
  }

  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'keyword',
    graphData: null,
    fallbackGraphMetaKey: 'graph:doc:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    prevSemanticMode: 'document',
    prevDatasetKey: datasetKey,
    prevLayoutViewKey: 'view:prev',
    prevMode: 'force',
    mode: 'force',
    prevFrontmatterMode: false,
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    renderMode: '2d',
    renderVariant: 'd3',
    prevLayoutVariant: '',
    layoutVariant: '',
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey,
    layoutPositionCacheByMode: {
      [baselineKey]: baselinePositions,
    },
  })

  if (runtime.baselineLayoutPositions !== baselinePositions) {
    throw new Error('expected baseline layout runtime context to reuse the previous document cache entry')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextRejectsNonDocumentPreviousMode = () => {
  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'keyword',
    graphData: null,
    fallbackGraphMetaKey: 'graph:doc:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    prevSemanticMode: 'keyword',
    prevDatasetKey: 'graphId:test',
    prevLayoutViewKey: 'view:prev',
    prevMode: 'force',
    mode: 'force',
    prevFrontmatterMode: false,
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    renderMode: '2d',
    renderVariant: 'd3',
    prevLayoutVariant: '',
    layoutVariant: '',
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey: 'graphId:test',
    layoutPositionCacheByMode: {
      'graphId:test:document:default:force:2d:d3:v=view:prev': {
        a: { x: 1, y: 2 },
      },
    },
  })

  if (runtime.baselineLayoutPositions !== null) {
    throw new Error('expected baseline layout runtime context to require a previous document semantic mode before reusing previous baseline positions')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextPrefersPreviousBaselineDocumentPositions = () => {
  const datasetKey = 'graphId:test'
  const previousBaselinePositions = {
    a: { x: 70, y: 80 },
  }
  const previousBaselineKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: 'view:prev',
    renderVariant: 'd3',
    layoutVariant: '',
  })
  const currentBaselineViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'baseline:doc:1',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  })
  const currentBaselineKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: currentBaselineViewKey,
    renderVariant: 'd3',
    layoutVariant: '',
  })

  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'keyword',
    graphData: {
      type: 'Graph',
      context: 't',
      metadata: { baselineGraphMetaKey: 'baseline:doc:1' },
      nodes: [],
      edges: [],
    },
    fallbackGraphMetaKey: 'current:keyword:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey,
    mode: 'force',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: '',
    layoutPositionCacheByMode: {
      [previousBaselineKey]: previousBaselinePositions,
      [currentBaselineKey]: { a: { x: 10, y: 20 } },
    },
    prevSemanticMode: 'document',
    prevDatasetKey: datasetKey,
    prevLayoutViewKey: 'view:prev',
    prevMode: 'force',
    prevFrontmatterMode: false,
    prevLayoutVariant: '',
  })

  if (runtime.baselineLayoutPositions !== previousBaselinePositions) {
    throw new Error('expected baseline layout runtime context to prefer previous baseline document positions before current baseline fallback')
  }
  if (runtime.shouldSkipInitialLayoutFromBaselineDocumentPositions !== true) {
    throw new Error('expected baseline layout runtime context to expose skip-initial-layout intent when previous baseline document positions are reused')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextReturnsPositionsAndSkipFlagTogether = () => {
  const datasetKey = 'graphId:test'
  const baselineViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'baseline:doc:1',
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
  })
  const baselineKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: baselineViewKey,
    renderVariant: 'd3',
    layoutVariant: '',
  })
  const baselinePositions = { a: { x: 4, y: 5 } }

  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'keyword',
    graphData: {
      type: 'Graph',
      context: 't',
      metadata: { baselineGraphMetaKey: 'baseline:doc:1' },
      nodes: [],
      edges: [],
    },
    fallbackGraphMetaKey: 'current:keyword:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey,
    mode: 'force',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: '',
    layoutPositionCacheByMode: {
      [baselineKey]: baselinePositions,
    },
  })

  if (runtime.baselineLayoutPositions !== baselinePositions) {
    throw new Error('expected baseline layout runtime context to return the shared baseline positions')
  }
  if (runtime.shouldSkipInitialLayoutFromBaselineDocumentPositions !== true) {
    throw new Error('expected baseline layout runtime context to derive skip-initial-layout intent from the shared baseline positions')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextRequiresKeywordModeForSkipFlag = () => {
  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'document',
    graphData: null,
    fallbackGraphMetaKey: 'graph:doc:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey: 'graphId:test',
    mode: 'force',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: '',
    layoutPositionCacheByMode: {
      'graphId:test:document:default:force:2d:d3': {
        a: { x: 1, y: 2 },
      },
    },
  })

  if (runtime.shouldSkipInitialLayoutFromBaselineDocumentPositions !== false) {
    throw new Error('expected baseline layout runtime context to require keyword mode before exposing skip-initial-layout intent')
  }
}

export const testReadBaselineDocumentLayoutRuntimeContextRequiresBaselinePositionsForSkipFlag = () => {
  const runtime = readBaselineDocumentLayoutRuntimeContext({
    documentSemanticMode: 'keyword',
    graphData: null,
    fallbackGraphMetaKey: 'graph:doc:1',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: false,
    renderMediaAsNodes: true,
    mediaPanelDensity: 'default',
    collapsedGroupIdsKey: '',
    datasetKey: 'graphId:test',
    mode: 'force',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: '',
    layoutPositionCacheByMode: null,
  })

  if (runtime.shouldSkipInitialLayoutFromBaselineDocumentPositions !== false) {
    throw new Error('expected baseline layout runtime context to require baseline positions before exposing skip-initial-layout intent')
  }
}
