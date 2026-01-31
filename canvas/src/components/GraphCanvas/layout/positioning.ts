import { GraphNode } from '@/lib/graph/types';

export interface LayoutPositionConfig {
  mode: string;
  frontmatterMode: boolean;
  semanticMode: string;
  renderMode: '2d' | '3d';
  renderVariant?: string;
  prevMode: string | null;
  prevFrontmatterMode: boolean | null;
  prevSemanticMode: string | null;
  prevRenderMode: '2d' | '3d' | null;
  nodes: GraphNode[];
  layoutPositionCacheByMode: Record<string, Record<string, { x: number; y: number }>> | null;
}

export interface LayoutPositionResult {
  layoutPositionsForMode: Record<string, { x: number; y: number }> | null;
  skipInitialLayout: boolean;
  cacheKey: string;
}

export const determineLayoutPositions = ({
  mode,
  frontmatterMode,
  semanticMode,
  renderMode,
  renderVariant,
  prevMode,
  prevFrontmatterMode,
  prevSemanticMode,
  prevRenderMode,
  nodes,
  layoutPositionCacheByMode,
}: LayoutPositionConfig): LayoutPositionResult => {
  const isModeChange = prevMode !== mode;
  const isFrontmatterChange = prevFrontmatterMode !== frontmatterMode;
  const isSemanticChange = prevSemanticMode !== semanticMode;
  const isRenderModeChange = prevRenderMode !== renderMode;
  const baseKey = `${String(semanticMode || 'document')}:${frontmatterMode ? 'frontmatter' : 'default'}:${mode}:${renderMode}`
  const cacheKey = renderVariant ? `${baseKey}:${String(renderVariant)}` : baseKey

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

  const shouldUseCache =
    !!cachedPositions &&
    coverageFromCache >= 0.95 &&
    (isModeChange || isFrontmatterChange || isSemanticChange || isRenderModeChange || coverageFromNodes < 0.95);

  const layoutPositionsForMode = shouldUseCache ? cachedPositions : null;

  const skipInitialLayout =
    shouldUseCache || (!isModeChange && !isRenderModeChange && mode !== 'radial' && coverageFromNodes >= 0.95);

  return {
    layoutPositionsForMode,
    skipInitialLayout,
    cacheKey,
  };
};
