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

  const sourceLayerHash = typeof meta.sourceLayerHash === 'string' ? meta.sourceLayerHash.trim() : ''
  if (sourceLayerHash) return `sourceLayer:${sourceLayerHash}:rev:${rev}`

  const graphId = typeof meta.graphId === 'string' ? meta.graphId.trim() : ''
  if (graphId) return `graphId:${graphId}:rev:${rev}`

  const kind = typeof meta.kind === 'string' ? meta.kind.trim() : ''
  const source = typeof meta.source === 'string' ? meta.source.trim() : ''
  if (kind || source) return `meta:${kind}:${source}:rev:${rev}`

  const nodes = Array.isArray(graphData?.nodes) ? graphData!.nodes! : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const t = typeof n?.type === 'string' ? n.type.trim() : ''
    if (t !== 'Document') continue
    const props = isRecord(n?.properties) ? (n!.properties as Record<string, unknown>) : {}
    const path = typeof props.path === 'string' ? props.path.trim() : ''
    if (path) return `path:${path}:rev:${rev}`
    const nMeta = isRecord(n?.metadata) ? (n!.metadata as Record<string, unknown>) : {}
    const docPath = typeof nMeta.documentPath === 'string' ? nMeta.documentPath.trim() : ''
    if (docPath) return `doc:${docPath}:rev:${rev}`
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
  schemaNodesPresentationJson: string
  schemaGroupsPresentationJson: string
}): string => {
  return [
    String(args.schemaLayoutEngineJson),
    String(args.frontmatterModeEnabled ? 1 : 0),
    String(args.documentSemanticMode),
    String(args.graphMetaKey),
    String(args.renderMediaAsNodes ? 1 : 0),
    String(args.mediaPanelDensity),
    String(args.collapsedGroupIdsKey),
    String(args.schemaNodesPresentationJson),
    String(args.schemaGroupsPresentationJson),
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
  if (rv) parts.push(rv)
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
  const isDatasetChange = prevDatasetKey !== datasetKey
  const isModeChange = prevMode !== mode;
  const isFrontmatterChange = prevFrontmatterMode !== frontmatterMode;
  const isSemanticChange = prevSemanticMode !== semanticMode;
  const isRenderModeChange = prevRenderMode !== renderMode;
  const isRenderVariantChange = (prevRenderVariant ?? null) !== (renderVariant ?? null)
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

  const isLayoutEngineChange = isModeChange || isRenderModeChange || isRenderVariantChange || isLayoutVariantChange
  const shouldUseCache =
    !!cachedPositions &&
    coverageFromCache >= 0.95 &&
    (!isDatasetChange && (isModeChange || isFrontmatterChange || isSemanticChange || isRenderModeChange || isRenderVariantChange || isLayoutVariantChange || coverageFromNodes < 0.95));

  const layoutPositionsForMode = shouldUseCache ? cachedPositions : null;

  const skipInitialLayout =
    shouldUseCache || (!isLayoutEngineChange && mode !== 'radial' && coverageFromNodes >= 0.95);

  return {
    layoutPositionsForMode,
    skipInitialLayout,
    cacheKey,
  };
};
