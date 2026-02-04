import { buildLayoutPositionCacheKey, buildLayoutViewKey, determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import type { GraphNode } from '@/lib/graph/types'

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
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  })

  const baseStratify = {
    datasetKey,
    mode: 'stratify',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  } as const
  const stratifyVertical = determineLayoutPositions({ ...baseStratify, layoutVariant: 'o=vertical' })
  const stratifyHorizontal = determineLayoutPositions({ ...baseStratify, layoutVariant: 'o=horizontal' })

  if (d3.cacheKey !== `${datasetKey}:document:default:force:2d:d3`) {
    throw new Error(`expected d3 cacheKey ${datasetKey}:document:default:force:2d:d3, got ${d3.cacheKey}`)
  }
  if (flow.cacheKey !== `${datasetKey}:document:default:force:2d:flow`) {
    throw new Error(`expected flow cacheKey ${datasetKey}:document:default:force:2d:flow, got ${flow.cacheKey}`)
  }
  if (stratifyVertical.cacheKey !== `${datasetKey}:document:default:stratify:2d:d3:o=vertical`) {
    throw new Error(`expected stratify vertical cacheKey ${datasetKey}:document:default:stratify:2d:d3:o=vertical, got ${stratifyVertical.cacheKey}`)
  }
  if (stratifyHorizontal.cacheKey !== `${datasetKey}:document:default:stratify:2d:d3:o=horizontal`) {
    throw new Error(`expected stratify horizontal cacheKey ${datasetKey}:document:default:stratify:2d:d3:o=horizontal, got ${stratifyHorizontal.cacheKey}`)
  }
}

export const testLayoutPositioningForcesLayoutWhenVariantChanges = () => {
  const datasetKey = 'graphId:test'
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const res = determineLayoutPositions({
    datasetKey,
    mode: 'stratify',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: 'o=horizontal',
    prevDatasetKey: datasetKey,
    prevMode: 'stratify',
    prevFrontmatterMode: false,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    prevRenderVariant: 'd3',
    prevLayoutVariant: 'o=vertical',
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
    schemaNodesPresentationJson: '{"nodeShapes":{"Image":"rect"}}',
    schemaGroupsPresentationJson: '{"groups":{"enabled":true}}',
  } as const
  const viewA = buildLayoutViewKey(base)
  const viewB = buildLayoutViewKey({ ...base, collapsedGroupIdsKey: 'community:0' })

  const keyA = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    viewKey: viewA,
  })
  const keyB = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
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
    schemaNodesPresentationJson: '{"nodeShapes":{"Image":"rect"}}',
    schemaGroupsPresentationJson: '{"groups":{"enabled":true}}',
  } as const
  const viewDefault = buildLayoutViewKey(base)
  const viewCompact = buildLayoutViewKey({ ...base, mediaPanelDensity: 'compact' })

  const keyDefault = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    viewKey: viewDefault,
  })
  const keyCompact = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
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
    schemaNodesPresentationJson: '{"nodeShapes":{"Image":"rect"}}',
    schemaGroupsPresentationJson: '{"groups":{"enabled":true}}',
  } as const
  const viewOn = buildLayoutViewKey(base)
  const viewOff = buildLayoutViewKey({ ...base, renderMediaAsNodes: false })

  const keyOn = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    viewKey: viewOn,
  })
  const keyOff = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    viewKey: viewOff,
  })
  if (keyOn === keyOff) {
    throw new Error('expected layout cache key to differ between renderMediaAsNodes states')
  }
}
