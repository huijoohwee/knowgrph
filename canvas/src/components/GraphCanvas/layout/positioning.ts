import { GraphNode } from '@/lib/graph/types';

export interface LayoutPositionConfig {
  mode: string;
  layerMode: string;
  frontmatterMode: boolean;
  prevMode: string | null;
  prevLayerMode: string | null;
  prevFrontmatterMode: boolean | null;
  nodes: GraphNode[];
  edgesRevision: number;
  layoutPositionCacheByMode: Record<string, Record<string, { x: number; y: number }>> | null;
}

export interface LayoutPositionResult {
  layoutPositionsForMode: Record<string, { x: number; y: number }> | null;
  skipInitialLayout: boolean;
  cacheKey: string;
}

export const determineLayoutPositions = ({
  mode,
  layerMode,
  frontmatterMode,
  prevMode,
  prevLayerMode,
  prevFrontmatterMode,
  nodes,
  edgesRevision,
  layoutPositionCacheByMode,
}: LayoutPositionConfig): LayoutPositionResult => {
  const isModeChange = prevMode !== mode;
  const isLayerChange = prevLayerMode !== layerMode;
  const isFrontmatterChange = prevFrontmatterMode !== frontmatterMode;
  const isStructuredMode = mode === 'radial' || mode === 'tree' || mode === 'mermaid';
  const cacheKey = `${layerMode}:${mode}:${frontmatterMode ? 'fm' : 'full'}:${edgesRevision}`;

  // If not structured, we don't use cache for *target* positions in the same way,
  // though we might use prevPositions for stability (handled by caller).
  if (!isStructuredMode) {
    return {
      layoutPositionsForMode: null,
      skipInitialLayout: false,
      cacheKey,
    };
  }

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

  // Calculate coverage from cache
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

  // Decision logic
  // We use cache if:
  // 1. We have a good cache (high coverage)
  // 2. AND (We are changing modes OR the current nodes don't have good positions)
  const shouldUseCache =
    !!cachedPositions &&
    coverageFromCache >= 0.95 &&
    (isModeChange || isLayerChange || isFrontmatterChange || coverageFromNodes < 0.95);

  const layoutPositionsForMode = shouldUseCache ? cachedPositions : null;

  // We skip initial layout calculation (e.g. force sim or re-running dagre) if:
  // 1. We are using the cache (positions are already good)
  // 2. OR We are not changing modes and current nodes are already positioned (e.g. minor updates)
  const skipInitialLayout =
    shouldUseCache ||
    (!isModeChange && !isLayerChange && !isFrontmatterChange && coverageFromNodes >= 0.95);

  return {
    layoutPositionsForMode,
    skipInitialLayout,
    cacheKey,
  };
};
