import { GraphSchema } from '@/lib/graph/schema';
import { GraphEdge } from '@/lib/graph/types';

export type TreeDerivation = {
  candidateEdges: GraphEdge[];
  direction: 'source-target' | 'target-source';
  labelSet: Set<string>;
};

export type TreeCacheKey = string;

export const treeDerivationCache = new WeakMap<GraphEdge[], Map<TreeCacheKey, TreeDerivation | null>>();

export const normalizeEdgeLabels = (raw: unknown): string[] => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(raw)) {
    return raw
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }
  return [];
};

export const pickMostCommonEdgeLabel = (edges: GraphEdge[]): string | null => {
  if (!edges.length) return null;
  const counts = new Map<string, number>();
  for (let i = 0; i < edges.length; i += 1) {
    const l = String(edges[i].label ?? '').trim();
    if (!l) continue;
    counts.set(l, (counts.get(l) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  counts.forEach((count, label) => {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    } else if (count === bestCount && best && label.localeCompare(best) < 0) {
      best = label;
    }
  });
  return best;
};

export const resolveTreeDirection = (
  cfg: NonNullable<NonNullable<GraphSchema['layout']>['tree']> | undefined,
  edges: GraphEdge[],
  nodeIds: Set<string>,
): 'source-target' | 'target-source' => {
  const raw = cfg?.direction;
  if (raw === 'source-target' || raw === 'target-source') return raw;
  const countRoots = (dir: 'source-target' | 'target-source') => {
    const parentByChild = new Map<string, string>();
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i];
      const src = String(e.source);
      const tgt = String(e.target);
      const parent = dir === 'source-target' ? src : tgt;
      const child = dir === 'source-target' ? tgt : src;
      if (!parent || !child) continue;
      if (parent === child) continue;
      if (!nodeIds.has(parent) || !nodeIds.has(child)) continue;
      if (!parentByChild.has(child)) parentByChild.set(child, parent);
    }
    let roots = 0;
    nodeIds.forEach(id => {
      if (!parentByChild.has(id)) roots += 1;
    });
    return roots;
  };
  const rootsST = countRoots('source-target');
  const rootsTS = countRoots('target-source');
  if (rootsST === 1 && rootsTS !== 1) return 'source-target';
  if (rootsTS === 1 && rootsST !== 1) return 'target-source';
  if (rootsST > 0 && rootsTS > 0) return rootsST <= rootsTS ? 'source-target' : 'target-source';
  if (rootsST > 0) return 'source-target';
  if (rootsTS > 0) return 'target-source';
  return 'source-target';
};

export const getTreeCacheKey = (
  cfg: NonNullable<NonNullable<GraphSchema['layout']>['tree']> | undefined,
): TreeCacheKey => {
  const labels = normalizeEdgeLabels(cfg?.edgeLabels);
  const dir = cfg?.direction === 'source-target' || cfg?.direction === 'target-source' ? cfg.direction : 'auto';
  const joined = labels.join('|');
  return `${joined}::${dir}`;
};

export const deriveTreeDerivation = (
  edgesForSim: GraphEdge[],
  schema: GraphSchema,
  nodeIds: Set<string>,
): TreeDerivation | null => {
  const treeCfg = schema.layout?.tree;
  const cacheKey = getTreeCacheKey(treeCfg);
  const cachedByCfg = treeDerivationCache.get(edgesForSim);
  if (cachedByCfg && cachedByCfg.has(cacheKey)) {
    const cached = cachedByCfg.get(cacheKey) || null;
    return cached;
  }

  const configuredLabels = normalizeEdgeLabels(treeCfg?.edgeLabels);
  const labelToUse = configuredLabels.length > 0 ? null : pickMostCommonEdgeLabel(edgesForSim);
  const labelSet =
    configuredLabels.length > 0
      ? new Set<string>(configuredLabels)
      : labelToUse
        ? new Set<string>([labelToUse])
        : new Set<string>();

  const candidateEdges =
    labelSet.size > 0
      ? edgesForSim.filter(e => labelSet.has(String(e.label ?? '').trim()))
      : edgesForSim.slice();

  if (!candidateEdges.length) {
    if (cachedByCfg) {
      cachedByCfg.set(cacheKey, null);
    } else {
      const m = new Map<TreeCacheKey, TreeDerivation | null>();
      m.set(cacheKey, null);
      treeDerivationCache.set(edgesForSim, m);
    }
    return null;
  }

  const direction = resolveTreeDirection(treeCfg, candidateEdges, nodeIds);
  const result: TreeDerivation = { candidateEdges, direction, labelSet };

  if (cachedByCfg) {
    cachedByCfg.set(cacheKey, result);
  } else {
    const m = new Map<TreeCacheKey, TreeDerivation | null>();
    m.set(cacheKey, result);
    treeDerivationCache.set(edgesForSim, m);
  }

  return result;
};
