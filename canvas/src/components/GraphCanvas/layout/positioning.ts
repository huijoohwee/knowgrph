import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readBaselineGraphMetaKey } from '@/lib/graph/graphMetaKey'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'

import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/lib/canvas/layoutPositioning'
import { pickSeedFromOtherRendererCache } from '@/lib/canvas/layoutSeed'

export interface LayoutPositionConfig {
  datasetKey: string;
  mode: string;
  frontmatterMode: boolean;
  semanticMode: string;
  renderMode: '2d' | '3d';
  renderVariant?: string;
  layoutVariant?: string;
  viewKey?: string;
  prevViewKey?: string | null;
  prevDatasetKey: string | null;
  prevMode: string | null;
  prevFrontmatterMode: boolean | null;
  prevSemanticMode: string | null;
  prevRenderMode: '2d' | '3d' | null;
  prevRenderVariant?: string | null;
  prevLayoutVariant?: string | null;
  nodes: GraphNode[];
  layoutPositionCacheByMode: Record<string, Record<string, { x: number; y: number }>> | null;
}

export interface LayoutPositionResult {
  layoutPositionsForMode: Record<string, { x: number; y: number }> | null;
  skipInitialLayout: boolean;
  cacheKey: string;
}

type PositionMap = Record<string, { x: number; y: number }>

const readCachedPositionMap = (
  cache: Record<string, PositionMap> | null | undefined,
  key: string | null | undefined,
): PositionMap | null => {
  if (!cache || !key) return null
  const found = cache[key] ?? null
  return found && Object.keys(found).length > 0 ? found : null
}

export function readCurrentLayoutPrepContext(args: {
  graphData: { nodes?: unknown[]; edges?: unknown[] } | null | undefined
  graphDataRevision: number
  schemaLayoutEngineJson: string
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphMetaKey: string
  renderMediaAsNodes: boolean
  mediaPanelDensity: string
  collapsedGroupIdsKey: string
}): {
  datasetKey: string
  layoutViewKey: string
} {
  const datasetKey = computeLayoutDatasetKey({
    graphData: args.graphData ?? null,
    graphDataRevision: typeof args.graphDataRevision === 'number' && Number.isFinite(args.graphDataRevision)
      ? Math.floor(args.graphDataRevision)
      : 0,
  })
  const layoutViewKey = buildLayoutViewKey({
    schemaLayoutEngineJson: args.schemaLayoutEngineJson,
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    documentSemanticMode: args.documentSemanticMode,
    graphMetaKey: args.graphMetaKey,
    renderMediaAsNodes: args.renderMediaAsNodes,
    mediaPanelDensity: String(args.mediaPanelDensity),
    collapsedGroupIdsKey: args.collapsedGroupIdsKey,
  })
  return { datasetKey, layoutViewKey }
}

export function readCurrentLayoutResolutionContext(args: {
  schema: unknown
  semanticMode: string | null | undefined
  renderMode: '2d' | '3d'
  canvas2dRenderer?: string | null | undefined
  default2dRenderVariant?: string | null | undefined
}): {
  mode: ReturnType<typeof readLayoutMode>
  semanticMode: string
  renderVariant: string
} {
  return {
    mode: readLayoutMode(args.schema as GraphSchema),
    semanticMode: String(args.semanticMode || 'document'),
    renderVariant: args.renderMode === '2d'
      ? String(args.canvas2dRenderer || args.default2dRenderVariant || '')
      : '',
  }
}

export function readCurrentLayoutSeedContext(args: {
  datasetKey: string
  mode: string
  frontmatterModeEnabled: boolean
  semanticMode: string
  renderMode: '2d' | '3d'
  renderVariant: string
  layoutViewKey: string
  nodes: GraphNode[]
  layoutPositionCacheByMode: Record<string, PositionMap> | null | undefined
}): Pick<
  LayoutPositionConfig,
  'datasetKey'
  | 'mode'
  | 'frontmatterMode'
  | 'semanticMode'
  | 'renderMode'
  | 'renderVariant'
  | 'viewKey'
  | 'nodes'
  | 'layoutPositionCacheByMode'
> {
  return {
    datasetKey: args.datasetKey,
    mode: args.mode,
    frontmatterMode: args.frontmatterModeEnabled,
    semanticMode: args.semanticMode,
    renderMode: args.renderMode,
    renderVariant: args.renderVariant,
    viewKey: args.layoutViewKey,
    nodes: args.nodes,
    layoutPositionCacheByMode: args.layoutPositionCacheByMode ?? null,
  }
}

export function readCurrentLayoutHistoryContext(args: {
  prevViewKey?: string | null | undefined
  prevDatasetKey?: string | null | undefined
  prevMode?: string | null | undefined
  prevFrontmatterMode?: boolean | null | undefined
  prevSemanticMode?: string | null | undefined
  prevRenderMode?: '2d' | '3d' | null | undefined
  prevRenderVariant?: string | null | undefined
  prevLayoutVariant?: string | null | undefined
}): Pick<
  LayoutPositionConfig,
  | 'prevViewKey'
  | 'prevDatasetKey'
  | 'prevMode'
  | 'prevFrontmatterMode'
  | 'prevSemanticMode'
  | 'prevRenderMode'
  | 'prevRenderVariant'
  | 'prevLayoutVariant'
> {
  return {
    prevViewKey: args.prevViewKey ?? null,
    prevDatasetKey: args.prevDatasetKey ?? null,
    prevMode: args.prevMode ?? null,
    prevFrontmatterMode: args.prevFrontmatterMode ?? null,
    prevSemanticMode: args.prevSemanticMode ?? null,
    prevRenderMode: args.prevRenderMode ?? null,
    prevRenderVariant: args.prevRenderVariant ?? null,
    prevLayoutVariant: args.prevLayoutVariant ?? null,
  }
}

export function readBaselineDocumentLayoutRuntimeContext(args: {
  documentSemanticMode: string | null | undefined
  graphData: { metadata?: unknown } | null | undefined
  fallbackGraphMetaKey: string
  schemaLayoutEngineJson: string
  frontmatterModeEnabled: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: string
  collapsedGroupIdsKey: string
  datasetKey: string
  mode: string
  renderMode: '2d' | '3d'
  renderVariant?: string
  layoutVariant?: string
  layoutPositionCacheByMode: Record<string, PositionMap> | null | undefined
  prevSemanticMode?: string | null | undefined
  prevDatasetKey?: string | null | undefined
  prevLayoutViewKey?: string | null | undefined
  prevMode?: string | null | undefined
  prevFrontmatterMode?: boolean | null | undefined
  prevLayoutVariant?: string | null | undefined
}): {
  baselineLayoutPositions: PositionMap | null
  shouldSkipInitialLayoutFromBaselineDocumentPositions: boolean
} {
  const baselineLayoutPositions = (() => {
    if (String(args.documentSemanticMode || 'document') !== 'keyword') return null
    if (!args.layoutPositionCacheByMode) return null
    const baselineFromPrevKey = (() => {
      if (args.prevSemanticMode !== 'document') return null
      if (!args.prevDatasetKey || !args.prevLayoutViewKey) return null
      const key = buildLayoutPositionCacheKey({
        datasetKey: args.prevDatasetKey,
        mode: args.prevMode ?? args.mode,
        frontmatterMode: args.prevFrontmatterMode ?? args.frontmatterModeEnabled,
        semanticMode: 'document',
        renderMode: args.renderMode,
        viewKey: args.prevLayoutViewKey,
        renderVariant: args.renderVariant,
        layoutVariant: args.prevLayoutVariant ?? args.layoutVariant,
      })
      return readCachedPositionMap(args.layoutPositionCacheByMode, key)
    })()
    if (baselineFromPrevKey) return baselineFromPrevKey
    const baselineGraphMetaKey = readBaselineGraphMetaKey(args.graphData, args.fallbackGraphMetaKey)
    const baselineLayoutViewKey = buildLayoutViewKey({
      schemaLayoutEngineJson: args.schemaLayoutEngineJson,
      frontmatterModeEnabled: args.frontmatterModeEnabled,
      documentSemanticMode: 'document',
      graphMetaKey: baselineGraphMetaKey,
      renderMediaAsNodes: args.renderMediaAsNodes,
      mediaPanelDensity: String(args.mediaPanelDensity),
      collapsedGroupIdsKey: args.collapsedGroupIdsKey,
    })
    const baselineKey = buildLayoutPositionCacheKey({
      datasetKey: args.datasetKey,
      mode: args.mode,
      frontmatterMode: args.frontmatterModeEnabled,
      semanticMode: 'document',
      renderMode: args.renderMode,
      viewKey: baselineLayoutViewKey,
      renderVariant: args.renderVariant,
      layoutVariant: args.layoutVariant,
    })
    return readCachedPositionMap(args.layoutPositionCacheByMode, baselineKey)
  })()
  return {
    baselineLayoutPositions,
    shouldSkipInitialLayoutFromBaselineDocumentPositions:
      String(args.documentSemanticMode || 'document') === 'keyword' && !!baselineLayoutPositions,
  }
}

function computePositionBBox(nodes: GraphNode[], positions: PositionMap | null): null | {
  valid: number
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  if (!positions) return null
  if (nodes.length === 0) return null
  let valid = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    const p = positions[String(nodes[i].id)]
    if (!p) continue
    const x = typeof p.x === 'number' ? p.x : null
    const y = typeof p.y === 'number' ? p.y : null
    if (x == null || y == null) continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    valid += 1
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (valid === 0) return null
  return { valid, minX, maxX, minY, maxY }
}

function spreadOutIfTooTight(nodes: GraphNode[], positions: PositionMap): PositionMap {
  const bbox = computePositionBBox(nodes, positions)
  if (!bbox) return positions
  const width = bbox.maxX - bbox.minX
  const height = bbox.maxY - bbox.minY
  if (!(width >= 0) || !(height >= 0)) return positions
  if (bbox.valid < 4) return positions

  const bucketCellPx = 36
  const bucketCountInfo = (() => {
    let inBuckets = 0
    let maxBucket = 0
    const byBucket = new Map<string, string[]>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i].id)
      if (!id) continue
      const p = positions[id]
      if (!p) continue
      const x = p.x
      const y = p.y
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const bx = Math.round(x / bucketCellPx)
      const by = Math.round(y / bucketCellPx)
      const key = `${bx}|${by}`
      const arr = byBucket.get(key) || []
      arr.push(id)
      byBucket.set(key, arr)
    }
    byBucket.forEach(arr => {
      if (arr.length > 1) inBuckets += arr.length
      if (arr.length > maxBucket) maxBucket = arr.length
    })
    return { byBucket, inBuckets, maxBucket }
  })()

  const duplicateRatio = bucketCountInfo.inBuckets / Math.max(1, bbox.valid)
  const hasMeaningfulDuplicates = bucketCountInfo.maxBucket >= 4 || duplicateRatio >= 0.14

  const minDim = Math.max(80, Math.floor(Math.sqrt(bbox.valid) * 60))
  const base = Math.max(1, Math.max(width, height))
  const needsScaleUp = base < minDim
  if (!needsScaleUp && !hasMeaningfulDuplicates) return positions

  const scale = needsScaleUp ? Math.max(1, Math.min(8, minDim / base)) : 1
  let cx = 0
  let cy = 0
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const p = positions[String(nodes[i].id)]
    if (!p) continue
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    cx += p.x
    cy += p.y
    count += 1
  }
  if (count <= 0) return positions
  cx /= count
  cy /= count
  const out: PositionMap = { ...positions }
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i].id)
    const p = positions[id]
    if (!p) continue
    const x = p.x
    const y = p.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out[id] = { x: cx + (x - cx) * scale, y: cy + (y - cy) * scale }
  }

  if (hasMeaningfulDuplicates) {
    const hash01 = (s: string): number => {
      let h = 2166136261
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
      }
      return (h >>> 0) / 4294967296
    }
    const golden = 2.399963229728653
    const jitterBase = Math.max(12, Math.min(64, Math.floor(bucketCellPx * 0.62)))

    bucketCountInfo.byBucket.forEach((ids) => {
      if (ids.length <= 1) return
      const sorted = [...ids].sort((a, b) => a.localeCompare(b))
      for (let i = 0; i < sorted.length; i += 1) {
        const id = sorted[i]!
        const p = out[id]
        if (!p) continue
        const a = i * golden + hash01(id) * Math.PI * 2
        const ring = Math.floor(i / 10)
        const r = jitterBase * (0.55 + ring * 0.38)
        out[id] = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }
      }
    })
  }

  return out
}

export { computeLayoutDatasetKey, buildLayoutViewKey, buildLayoutPositionCacheKey }

export const determineLayoutPositions = ({
  datasetKey,
  mode,
  frontmatterMode,
  semanticMode,
  renderMode,
  renderVariant,
  layoutVariant,
  viewKey,
  prevViewKey,
  prevDatasetKey,
  prevMode,
  prevFrontmatterMode,
  prevSemanticMode,
  prevRenderMode,
  prevRenderVariant,
  prevLayoutVariant,
  nodes,
  layoutPositionCacheByMode,
}: LayoutPositionConfig): LayoutPositionResult => {
  const isInitial = prevDatasetKey == null && prevMode == null && prevRenderMode == null
  const isDatasetChange = prevDatasetKey !== datasetKey
  const isModeChange = prevMode !== mode;
  const isFrontmatterChange = prevFrontmatterMode !== frontmatterMode;
  const isSemanticChange = prevSemanticMode !== semanticMode;
  const isRenderModeChange = prevRenderMode !== renderMode;
  const isRenderVariantChange =
    renderMode === '3d' && (prevRenderVariant ?? null) !== (renderVariant ?? null)
  const isLayoutVariantChange = (prevLayoutVariant ?? null) !== (layoutVariant ?? null)
  const cacheKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode,
    frontmatterMode,
    semanticMode,
    renderMode,
    viewKey,
    renderVariant,
    layoutVariant,
  })

  // Calculate coverage of current node positions (are they valid?)
  const coverageFromNodes = (() => {
    if (nodes.length === 0) return 0;
    let matches = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      const x = typeof n.x === 'number' ? n.x : null;
      const y = typeof n.y === 'number' ? n.y : null;
      if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
        matches += 1;
      }
    }
    return matches / Math.max(1, nodes.length);
  })();

  const spreadQualityFromNodes = (() => {
    if (nodes.length <= 1) return true
    let valid = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' ? n.x : null
      const y = typeof n.y === 'number' ? n.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      valid += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    if (valid <= 1) return false
    const spreadX = maxX - minX
    const spreadY = maxY - minY
    if (valid >= 4 && spreadX < 40 && spreadY < 40) return false

    const cell = 36
    let inBuckets = 0
    let maxBucket = 0
    const buckets = new Map<string, number>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' ? n.x : null
      const y = typeof n.y === 'number' ? n.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const bx = Math.round(x / cell)
      const by = Math.round(y / cell)
      const key = `${bx}|${by}`
      const next = (buckets.get(key) || 0) + 1
      buckets.set(key, next)
      if (next > maxBucket) maxBucket = next
    }
    buckets.forEach(v => {
      if (v > 1) inBuckets += v
    })
    const dupRatio = inBuckets / Math.max(1, valid)
    if (maxBucket >= 4 || dupRatio >= 0.14) return false

    return spreadX > 0.001 || spreadY > 0.001
  })()

  const cachedPositions = (() => {
    const cache = layoutPositionCacheByMode
    if (!cache) return null
    const direct = cache[cacheKey] ?? null
    if (direct) return direct
    const baseKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode,
      frontmatterMode,
      semanticMode,
      renderMode,
      viewKey,
    })
    return pickSeedFromOtherRendererCache({
      nodes,
      cache: cache as unknown as Record<string, Record<string, { x: number; y: number }>>,
      baseKey,
      expectedKey: cacheKey,
      expectedLayoutVariant: layoutVariant,
    })
  })()
  const coverageFromCache = (() => {
    if (!cachedPositions) return 0;
    if (nodes.length === 0) return 0;
    let matches = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      const p = cachedPositions[String(nodes[i].id)];
      if (!p) continue;
      const x = typeof p.x === 'number' ? p.x : null;
      const y = typeof p.y === 'number' ? p.y : null;
      if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
        matches += 1;
      }
    }
    return matches / Math.max(1, nodes.length);
  })();

  const spreadQualityFromCache = (() => {
    if (!cachedPositions) return false
    if (nodes.length <= 1) return true
    let valid = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < nodes.length; i += 1) {
      const p = cachedPositions[String(nodes[i].id)]
      if (!p) continue
      const x = typeof p.x === 'number' ? p.x : null
      const y = typeof p.y === 'number' ? p.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      valid += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    if (valid <= 1) return false
    const spreadX = maxX - minX
    const spreadY = maxY - minY
    if (valid >= 4 && spreadX < 40 && spreadY < 40) return false

    const cell = 36
    let inBuckets = 0
    let maxBucket = 0
    const buckets = new Map<string, number>()
    for (let i = 0; i < nodes.length; i += 1) {
      const p = cachedPositions[String(nodes[i].id)]
      if (!p) continue
      const x = typeof p.x === 'number' ? p.x : null
      const y = typeof p.y === 'number' ? p.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const bx = Math.round(x / cell)
      const by = Math.round(y / cell)
      const key = `${bx}|${by}`
      const next = (buckets.get(key) || 0) + 1
      buckets.set(key, next)
      if (next > maxBucket) maxBucket = next
    }
    buckets.forEach(v => {
      if (v > 1) inBuckets += v
    })
    const dupRatio = inBuckets / Math.max(1, valid)
    if (maxBucket >= 4 || dupRatio >= 0.14) return false

    return spreadX > 0.001 || spreadY > 0.001
  })()

  const isLayoutEngineChange = isModeChange || isRenderModeChange || isRenderVariantChange || isLayoutVariantChange

  const cachedPositionsSpread =
    cachedPositions && coverageFromCache >= 0.95 && !spreadQualityFromCache
      ? spreadOutIfTooTight(nodes, cachedPositions)
      : null

  const prevCachePositions = (() => {
    if (!layoutPositionCacheByMode) return null
    if (!prevDatasetKey || prevDatasetKey !== datasetKey) return null
    if (!prevViewKey) return null
    const prevKey = buildLayoutPositionCacheKey({
      datasetKey,
      mode: prevMode ?? mode,
      frontmatterMode: prevFrontmatterMode ?? frontmatterMode,
      semanticMode: prevSemanticMode ?? semanticMode,
      renderMode: prevRenderMode ?? renderMode,
      viewKey: prevViewKey,
      renderVariant: prevRenderVariant ?? renderVariant,
      layoutVariant: prevLayoutVariant ?? layoutVariant,
    })
    const p = layoutPositionCacheByMode[prevKey] ?? null
    if (!p) return null
    const coverage = (() => {
      if (nodes.length === 0) return 0
      let matches = 0
      for (let i = 0; i < nodes.length; i += 1) {
        const pos = p[String(nodes[i].id)]
        if (!pos) continue
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue
        matches += 1
      }
      return matches / Math.max(1, nodes.length)
    })()
    if (coverage < 0.95) return null
    const quality = (() => {
      if (nodes.length <= 1) return true
      let valid = 0
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let i = 0; i < nodes.length; i += 1) {
        const pos = p[String(nodes[i].id)]
        if (!pos) continue
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue
        valid += 1
        if (pos.x < minX) minX = pos.x
        if (pos.x > maxX) maxX = pos.x
        if (pos.y < minY) minY = pos.y
        if (pos.y > maxY) maxY = pos.y
      }
      if (valid <= 1) return false
      const spreadX = maxX - minX
      const spreadY = maxY - minY
      if (valid >= 4 && spreadX < 40 && spreadY < 40) return false

      const cell = 36
      let inBuckets = 0
      let maxBucket = 0
      const buckets = new Map<string, number>()
      for (let i = 0; i < nodes.length; i += 1) {
        const pos = p[String(nodes[i].id)]
        if (!pos) continue
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue
        const bx = Math.round(pos.x / cell)
        const by = Math.round(pos.y / cell)
        const key = `${bx}|${by}`
        const next = (buckets.get(key) || 0) + 1
        buckets.set(key, next)
        if (next > maxBucket) maxBucket = next
      }
      buckets.forEach(v => {
        if (v > 1) inBuckets += v
      })
      const dupRatio = inBuckets / Math.max(1, valid)
      if (maxBucket >= 4 || dupRatio >= 0.14) return false

      return spreadX > 0.001 || spreadY > 0.001
    })()
    return quality ? p : spreadOutIfTooTight(nodes, p)
  })()
  const shouldUseCache =
    !!cachedPositions &&
    coverageFromCache >= 0.95 &&
    (spreadQualityFromCache || !!cachedPositionsSpread) &&
    (isDatasetChange || isModeChange || isFrontmatterChange || isSemanticChange || isRenderModeChange || isRenderVariantChange || isLayoutVariantChange || coverageFromNodes < 0.95);

  const layoutPositionsForMode =
    mode === 'radial'
      ? null
      : shouldUseCache
        ? (cachedPositionsSpread || cachedPositions)
        : prevCachePositions

  const skipInitialLayout =
    Boolean(layoutPositionsForMode) || ((isInitial || !isLayoutEngineChange) && mode !== 'radial' && coverageFromNodes >= 0.95);

  return {
    layoutPositionsForMode,
    skipInitialLayout,
    cacheKey,
  };
};
