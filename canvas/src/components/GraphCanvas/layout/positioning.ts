import { GraphNode } from '@/lib/graph/types'

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
  const minDim = Math.max(80, Math.floor(Math.sqrt(bbox.valid) * 60))
  const base = Math.max(1, Math.max(width, height))
  if (base >= minDim) return positions

  const scale = Math.max(1, Math.min(8, minDim / base))
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
