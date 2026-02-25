import { GraphNode } from '@/lib/graph/types';
import { hashStringToHex } from '@/lib/hash/stringHash';

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

type LayoutDatasetGraph = {
  metadata?: unknown
  nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }>
} | null

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export const computeLayoutDatasetKey = (args: { graphData: LayoutDatasetGraph; graphDataRevision: number }): string => {
  const rev = Number.isFinite(args.graphDataRevision) ? Math.floor(args.graphDataRevision) : 0
  const graphData = args.graphData
  const meta = isRecord(graphData?.metadata) ? graphData!.metadata as Record<string, unknown> : {}

  const kind = typeof meta.kind === 'string' ? meta.kind.trim() : ''
  if (kind === 'keyword') {
    const baselineDatasetKey = typeof meta.baselineDatasetKey === 'string' ? meta.baselineDatasetKey.trim() : ''
    if (baselineDatasetKey) return baselineDatasetKey
    const baselineSourceLayerHash = typeof meta.baselineSourceLayerHash === 'string' ? meta.baselineSourceLayerHash.trim() : ''
    if (baselineSourceLayerHash) return `sourceLayer:${baselineSourceLayerHash}`
  }

  const sourceLayerHash = typeof meta.sourceLayerHash === 'string' ? meta.sourceLayerHash.trim() : ''
  if (sourceLayerHash) return `sourceLayer:${sourceLayerHash}`

  const graphId = typeof meta.graphId === 'string' ? meta.graphId.trim() : ''
  if (graphId) return `graphId:${graphId}`

  
  const source = typeof meta.source === 'string' ? meta.source.trim() : ''
  if (kind || source) return `meta:${kind}:${source}`

  const nodes = Array.isArray(graphData?.nodes) ? graphData!.nodes! : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const t = typeof n?.type === 'string' ? n.type.trim() : ''
    if (t !== 'Document') continue
    const props = isRecord(n?.properties) ? (n!.properties as Record<string, unknown>) : {}
    const path = typeof props.path === 'string' ? props.path.trim() : ''
    if (path) return `path:${path}`
    const nMeta = isRecord(n?.metadata) ? (n!.metadata as Record<string, unknown>) : {}
    const docPath = typeof nMeta.documentPath === 'string' ? nMeta.documentPath.trim() : ''
    if (docPath) return `doc:${docPath}`
    break
  }

  return `rev:${rev}`
}

export const buildLayoutViewKey = (args: {
  schemaLayoutEngineJson: string
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphMetaKey: string
  renderMediaAsNodes: boolean
  mediaPanelDensity: string
  collapsedGroupIdsKey: string
}): string => {
  return [
    String(args.schemaLayoutEngineJson),
    String(args.frontmatterModeEnabled ? 1 : 0),
    String(args.documentSemanticMode),
    String(args.graphMetaKey),
    String(args.renderMediaAsNodes ? 1 : 0),
    String(args.mediaPanelDensity),
    String(args.collapsedGroupIdsKey),
  ].join('|')
}

export const buildLayoutPositionCacheKey = (args: {
  datasetKey: string
  mode: string
  frontmatterMode: boolean
  semanticMode: string
  renderMode: '2d' | '3d'
  renderVariant?: string
  layoutVariant?: string
  viewKey?: string
}): string => {
  const datasetKey = String(args.datasetKey || '').trim() || 'dataset:unknown'
  const baseKey = `${datasetKey}:${String(args.semanticMode || 'document')}:${args.frontmatterMode ? 'frontmatter' : 'default'}:${args.mode}:${args.renderMode}`
  const parts = [baseKey]
  const vk = typeof args.viewKey === 'string' ? args.viewKey.trim() : ''
  const rv = typeof args.renderVariant === 'string' ? args.renderVariant.trim() : ''
  const lv = typeof args.layoutVariant === 'string' ? args.layoutVariant.trim() : ''
  if (vk) parts.push(`v=${hashStringToHex(vk)}`)
  if (args.renderMode === '3d' && rv) parts.push(rv)
  if (lv) parts.push(lv)
  return parts.join(':')
}

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

  const cachedPositions = layoutPositionCacheByMode ? (layoutPositionCacheByMode[cacheKey] ?? null) : null;
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
    (isDatasetChange || isModeChange || isFrontmatterChange || isSemanticChange || isRenderModeChange || isRenderVariantChange || isLayoutVariantChange || coverageFromNodes < 0.95 || !spreadQualityFromNodes);

  const layoutPositionsForMode =
    mode === 'radial'
      ? null
      : shouldUseCache
        ? (cachedPositionsSpread || cachedPositions)
        : prevCachePositions

  const skipInitialLayout =
    Boolean(layoutPositionsForMode) || ((isInitial || !isLayoutEngineChange) && mode !== 'radial' && coverageFromNodes >= 0.95 && spreadQualityFromNodes);

  return {
    layoutPositionsForMode,
    skipInitialLayout,
    cacheKey,
  };
};
