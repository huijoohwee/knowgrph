import type { GraphNode } from './types';

export interface GraphBehavior {
  allowEdgeCreation: boolean;
  allowNodeDrag: boolean;
  dragConstraint?: 'free' | 'axis-x' | 'axis-y' | 'none';
  snapGrid?: { enabled: boolean; size: number };
  preventDuplicatesGlobal?: boolean;
  preventSelfLoopsGlobal?: boolean;
  selectMode?: 'single' | 'multi' | 'lasso';
  createMode?: 'shift-drag' | 'click-source-target' | 'panel-only';
  hover?: { enabled?: boolean; intensity?: number; debounceMs?: number };
  expansion?: {
    enabled?: boolean;
    highlightNeighbors?: boolean;
    zoomOnSelection?: boolean;
    zoomOnDoubleClick?: boolean;
  };
  defaultNodeType?: string;
}

export interface PropertySpec {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  uniqueness?: boolean;
  pattern?: string;
  range?: { min?: number; max?: number };
  enum?: string[];
  default?: import('./types').JSONValue;
  description?: string;
}

export function getNodePropSpec(schema: GraphSchema | null | undefined, nodeType: string, prop: string): PropertySpec | null {
  if (!schema || !schema.propertySchemas || !schema.propertySchemas.node) return null;
  const byOwner = schema.propertySchemas.node[nodeType];
  if (!byOwner) return null;
  const spec = byOwner[prop];
  return spec || null;
}

export function getEdgePropSpec(schema: GraphSchema | null | undefined, edgeLabel: string, prop: string): PropertySpec | null {
  if (!schema || !schema.propertySchemas || !schema.propertySchemas.edge) return null;
  const byOwner = schema.propertySchemas.edge[edgeLabel];
  if (!byOwner) return null;
  const spec = byOwner[prop];
  return spec || null;
}

export function summarizePropertySpec(spec: PropertySpec | null | undefined): string[] {
  const badges: string[] = [];
  if (!spec) return badges;
  if (spec.required) badges.push('required');
  if (spec.uniqueness) badges.push('unique');
  const range = spec.range;
  if (range && (typeof range.min === 'number' || typeof range.max === 'number')) {
    const min = typeof range.min === 'number' ? String(range.min) : '-∞';
    const max = typeof range.max === 'number' ? String(range.max) : '+∞';
    badges.push('range: ' + min + '..' + max);
  }
  if (spec.enum && spec.enum.length > 0) {
    const values = spec.enum.slice(0, 3).join(' | ');
    const suffix = spec.enum.length > 3 ? '…' : '';
    badges.push('enum: ' + values + suffix);
  }
  return badges;
}

export function toCompactPropertyBadgeLabel(badge: string): string {
  if (badge === 'required') return 'R';
  if (badge === 'unique') return 'U';
  if (badge.startsWith('range:')) return 'Rng';
  if (badge.startsWith('enum:')) return 'E';
  const trimmed = badge.trim();
  if (!trimmed) return '';
  return trimmed[0] ? trimmed[0].toUpperCase() : '';
}

export function sortPropertyBadgesByPriority(badges: string[]): string[] {
  const priority = (badge: string): number => {
    if (badge === 'required') return 0;
    if (badge === 'unique') return 1;
    if (badge.startsWith('range:')) return 2;
    if (badge.startsWith('enum:')) return 3;
    return 4;
  };
  return badges.slice().sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

export type CompactPropertyBadge = { badge: string; label: string };

export function buildNodeSchemaBadges(
  schema: GraphSchema | null | undefined,
  nodeType: string,
  properties: Record<string, unknown> | null | undefined,
): CompactPropertyBadge[] {
  if (!schema) return [];
  const props = properties || {};
  const keys = Object.keys(props);
  if (!keys.length) return [];
  const allBadges = new Set<string>();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const spec = getNodePropSpec(schema, nodeType, key);
    if (!spec) continue;
    const badges = summarizePropertySpec(spec);
    for (let j = 0; j < badges.length; j += 1) {
      allBadges.add(badges[j]);
    }
  }
  if (allBadges.size === 0) return [];
  const sortedBadges = sortPropertyBadgesByPriority(Array.from(allBadges)).slice(0, 4);
  return sortedBadges
    .map((badge) => ({ badge, label: toCompactPropertyBadgeLabel(badge) }))
    .filter((b) => b.label);
}

export function buildEdgeSchemaBadges(
  schema: GraphSchema | null | undefined,
  edgeLabel: string,
  properties: Record<string, unknown> | null | undefined,
): CompactPropertyBadge[] {
  if (!schema) return [];
  const props = properties || {};
  const keys = Object.keys(props);
  if (!keys.length) return [];
  const allBadges = new Set<string>();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const spec = getEdgePropSpec(schema, edgeLabel, key);
    if (!spec) continue;
    const badges = summarizePropertySpec(spec);
    for (let j = 0; j < badges.length; j += 1) {
      allBadges.add(badges[j]);
    }
  }
  if (allBadges.size === 0) return [];
  const sortedBadges = sortPropertyBadgesByPriority(Array.from(allBadges)).slice(0, 4);
  return sortedBadges
    .map((badge) => ({ badge, label: toCompactPropertyBadgeLabel(badge) }))
    .filter((b) => b.label);
}

export interface GraphSchema {
  nodeStyles: Record<string, { color?: string }>;
  edgeStyles: Record<string, { color?: string; width?: number; arrow?: boolean }>;
  metadata?: Record<string, import('./types').JSONValue>;
  nodeSizes?: Record<string, { radius?: number }>;
  nodeStroke?: Record<string, { color?: string; width?: number }>;
  labelStyles?: {
    fontSize?: number;
    color?: string;
    offset?: { dx?: number; dy?: number };
    halo?: { color?: string; width?: number };
  };
  nodeShapes?: Record<string, 'circle' | 'rect' | 'diamond' | 'hex' | 'image'>;
  edgeRouting?: { mode?: 'straight' | 'quadratic' | 'bundled'; curvatureByLabel?: Record<string, number> };
  rules: Array<{ target: 'node' | 'edge'; type?: string; required?: string[]; severity?: 'error' | 'warn' }>;
  validation?: {
    node?: Record<string, {
      required?: string[];
      types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>;
      patterns?: Record<string, string>;
      ranges?: Record<string, { min?: number; max?: number }>;
      uniqueness?: string[];
      severity?: 'error' | 'warn';
    }>;
    edge?: Record<string, {
      required?: string[];
      types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>;
      patterns?: Record<string, string>;
      ranges?: Record<string, { min?: number; max?: number }>;
      uniqueness?: string[];
      severity?: 'error' | 'warn';
    }>;
  };
  layout?: {
    mode?: 'force' | 'radial' | 'tidy-tree';
    forces?: {
      linkDistanceByLabel?: Record<string, number>;
      charge?: number;
      collisionByType?: Record<string, number>;
      centerStrength?: number;
      alphaDecay?: number;
    };
    fitPadding?: number;
    tidyTree?: {
      edgeLabels?: string[];
      direction?: 'auto' | 'source-target' | 'target-source';
      orientation?: 'vertical' | 'horizontal';
      nodeSize?: { x?: number; y?: number };
      separation?: number;
      sortBy?: 'none' | 'label' | 'id' | 'type';
      curve?: 'bump' | 'linear' | 'step';
      linkStroke?: string;
      linkOpacity?: number;
      linkWidth?: number;
      nodeRadius?: number;
      colorMode?: 'observable' | 'schema';
      internalFill?: string;
      leafFill?: string;
      labelFontSize?: number;
      labelFontFamily?: string;
    };
  };
  endpointMatrix?: Record<string, { sources: string[]; targets: string[] }>;
  cardinality?: {
    nodeType?: Record<string, { minEdges?: number; maxEdges?: number }>;
    edgeLabel?: Record<string, { maxPerNode?: number }>;
  };
  templates?: {
    node?: Record<string, Record<string, import('./types').JSONValue>>;
    edge?: Record<string, Record<string, import('./types').JSONValue>>;
  };
  performance?: {
    lod?: {
      hideLabelsBelowScale?: number;
      tidyTree?: {
        labelMode?: 'auto' | 'all' | 'internal' | 'none';
        maxLabels?: number;
        maxLeafLabels?: number;
      };
    };
    caps?: { maxNodes?: number; maxEdges?: number };
  };
  accessibility?: { highContrast?: boolean };
  legend?: { showLegend?: boolean };
  behavior: GraphBehavior;
  serialization?: {
    predicatesByLabel?: Record<string, string>;
    typesByNode?: Record<string, string>;
    context?: Record<string, import('./types').JSONValue>;
    version?: string;
  };
  catalog?: { nodeTypes: string[]; edgeLabels: string[] };
  propertySchemas?: {
    node?: Record<string, Record<string, PropertySpec>>;
    edge?: Record<string, Record<string, PropertySpec>>;
  };
  three?: {
    linkDirectionalArrowLength?: number;
    linkOpacity?: number;
    edgeOpacityByLabel?: Record<string, number>;
    layerOpacityByLayer?: Record<string, number>;
    linkCurvature?: number;
    linkCurveRotation?: number;
    linkDirectionalArrowRelPos?: number;
    linkDirectionalParticles?: number;
    linkDirectionalParticleSpeed?: number;
    sphereRadius?: number;
    seed?: number;
    minSpacing?: number;
    nodeMotionIntensity?: number;
    minimapOpacity?: number;
    starfieldEnabled?: boolean;
    starfieldCount?: number;
    starfieldRadius?: number;
    starfieldOpacity?: number;
    starfieldColor?: string;
    backgroundColor?: string;
    fogColor?: string;
    fogNear?: number;
    fogFar?: number;
    cameraDampingFactor?: number;
    cameraRotateSpeed?: number;
    cameraZoomSpeed?: number;
    cameraPanSpeed?: number;
    cameraAutoRotate?: boolean;
    cameraAutoRotateSpeed?: number;
    nodeSizingFormula?: 'schema' | 'importance';
    nodeImportanceSources?: string[];
    edgeWidthFormula?: 'schema' | 'weight';
    polygons?: {
      elevationOffset?: number;
      opacityMultiplier?: number;
    };
    selection?: {
      selectedNodeGlowIntensity?: number;
      dimmedNodeOpacity?: number;
      dimmedEdgeOpacity?: number;
      selectedEdgeWidth?: number;
      selectedEdgeColor?: string;
    };
  };
  layers?: {
    mode?: 'property' | 'document-structure' | 'semantic';
    documentStructure?: {
      minGroupSize?: number;
    };
    semantic?: {
      textKeys?: string[];
      minTokenLength?: number;
      maxTokensPerNode?: number;
      stopwords?: string[];
      similarityMetric?: 'cosine' | 'pmi';
      similarityEdgeLabel?: string;
      topKEdgesPerNode?: number;
      minSimilarity?: number;
      communityDetection?: {
        enabled?: boolean;
        resolution?: number;
        maxPasses?: number;
        maxMovesPerPass?: number;
      };
    };
  };
}

export type ThreeConfig = Partial<NonNullable<GraphSchema['three']>>;

export function getThreeConfig(schema: GraphSchema | null | undefined): ThreeConfig {
  const three = schema && schema.three;
  if (!three) return {};
  return three as ThreeConfig;
}

export type ThreeSelectionConfig = {
  selectedNodeGlowIntensity: number;
  dimmedNodeOpacity: number;
  dimmedEdgeOpacity: number;
  selectedEdgeWidth: number;
  selectedEdgeColor: string;
};

export function getThreeSelectionConfig(schema: GraphSchema | null | undefined): ThreeSelectionConfig {
  const threeCfg = getThreeConfig(schema);
  const raw = (threeCfg.selection || {}) as {
    selectedNodeGlowIntensity?: number;
    dimmedNodeOpacity?: number;
    dimmedEdgeOpacity?: number;
    selectedEdgeWidth?: number;
    selectedEdgeColor?: string;
  };
  const selectedNodeGlowIntensity =
    typeof raw.selectedNodeGlowIntensity === 'number' ? raw.selectedNodeGlowIntensity : 0.8;
  const dimmedNodeOpacity = typeof raw.dimmedNodeOpacity === 'number' ? raw.dimmedNodeOpacity : 0.2;
  const dimmedEdgeOpacity = typeof raw.dimmedEdgeOpacity === 'number' ? raw.dimmedEdgeOpacity : 0.2;
  const selectedEdgeWidth = typeof raw.selectedEdgeWidth === 'number' ? raw.selectedEdgeWidth : 3;
  const selectedEdgeColor =
    typeof raw.selectedEdgeColor === 'string' && raw.selectedEdgeColor.trim().length > 0
      ? raw.selectedEdgeColor
      : '#3B82F6';
  return {
    selectedNodeGlowIntensity,
    dimmedNodeOpacity,
    dimmedEdgeOpacity,
    selectedEdgeWidth,
    selectedEdgeColor,
  };
}

export type RendererPalette = {
  nodes: Record<string, string>;
  edges: Record<string, string>;
};

export const MVP_COLOR_PALETTE = {
  nodes: {
    idea: '#2563EB',
    hypothesis: '#EAB308',
    execution: '#22C55E',
    pivot: '#F97316',
    alert: '#EF4444',
  },
  edges: {
    critical: '#EF4444',
    neutral: '#9CA3AF',
  },
} as const;

const AGENTIC_RAG_TAG_PRIORITY: readonly string[] = ['idea', 'hypothesis', 'execution', 'pivot', 'alert'];

export function getAgenticRagTagColor(node: GraphNode, schema: GraphSchema): string | null {
  const props = node.properties || {};
  const raw = props.tags;
  if (!Array.isArray(raw)) return null;
  const tags: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const v = raw[i];
    if (typeof v === 'string' || typeof v === 'number') {
      const s = String(v).trim().toLowerCase();
      if (s) tags.push(s);
    }
  }
  if (!tags.length) return null;
  const palette = getRendererPalette(schema);
  const nodesPalette = palette.nodes || {};
  for (let i = 0; i < AGENTIC_RAG_TAG_PRIORITY.length; i += 1) {
    const key = AGENTIC_RAG_TAG_PRIORITY[i];
    if (!Object.prototype.hasOwnProperty.call(nodesPalette, key)) continue;
    if (!tags.includes(key)) continue;
    const color = nodesPalette[key];
    if (typeof color === 'string' && color.trim()) return color;
  }
  return null;
}

export function getRendererPalette(schema: GraphSchema | null | undefined): RendererPalette {
  const baseNodes = MVP_COLOR_PALETTE.nodes;
  const baseEdges = MVP_COLOR_PALETTE.edges;
  const meta =
    schema && schema.metadata && typeof schema.metadata === 'object' && !Array.isArray(schema.metadata)
      ? (schema.metadata as Record<string, unknown>)
      : null;
  const raw = meta && Object.prototype.hasOwnProperty.call(meta, 'renderer:palette')
    ? (meta['renderer:palette'] as unknown)
    : undefined;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { nodes?: Record<string, string>; edges?: Record<string, string> };
    return {
      nodes: { ...baseNodes, ...(obj.nodes || {}) },
      edges: { ...baseEdges, ...(obj.edges || {}) },
    };
  }
  return { nodes: baseNodes, edges: baseEdges };
}

export const defaultSchema: GraphSchema = {
  nodeStyles: {
    Entity: { color: MVP_COLOR_PALETTE.nodes.idea },
    Chunk: { color: MVP_COLOR_PALETTE.nodes.execution },
    EmbeddingMeta: { color: '#6B7280' },
  },
  edgeStyles: {
    relatedTo: { color: MVP_COLOR_PALETTE.edges.neutral, width: 1.5 },
  },
  metadata: {
    'renderer:palette': {
      nodes: {
        idea: MVP_COLOR_PALETTE.nodes.idea,
        hypothesis: MVP_COLOR_PALETTE.nodes.hypothesis,
        execution: MVP_COLOR_PALETTE.nodes.execution,
        pivot: MVP_COLOR_PALETTE.nodes.pivot,
        alert: MVP_COLOR_PALETTE.nodes.alert,
      },
      edges: {
        critical: MVP_COLOR_PALETTE.edges.critical,
        neutral: MVP_COLOR_PALETTE.edges.neutral,
      },
    },
  },
  nodeSizes: {},
  nodeStroke: {},
  labelStyles: { fontSize: 12, color: '#111111', offset: { dx: 12, dy: 4 }, halo: { color: '#ffffff', width: 3 } },
  nodeShapes: {},
  edgeRouting: { mode: 'straight', curvatureByLabel: {} },
  layout: {
    mode: 'force',
    forces: {
      linkDistanceByLabel: { relatedTo: 80 },
      charge: -300,
      collisionByType: {},
      centerStrength: 1,
      alphaDecay: 0.02,
    },
    fitPadding: 80,
  },
  endpointMatrix: {},
  cardinality: { nodeType: {}, edgeLabel: {} },
  templates: { node: {}, edge: {} },
  performance: { lod: { hideLabelsBelowScale: 0.0, tidyTree: { labelMode: 'auto' } }, caps: { maxNodes: 0, maxEdges: 0 } },
  accessibility: { highContrast: false },
  legend: { showLegend: false },
  rules: [],
  behavior: {
    allowEdgeCreation: true,
    allowNodeDrag: true,
    dragConstraint: 'free',
    snapGrid: { enabled: false, size: 10 },
    preventDuplicatesGlobal: true,
    preventSelfLoopsGlobal: true,
    hover: { enabled: true },
    expansion: {
      enabled: true,
      highlightNeighbors: true,
      zoomOnSelection: true,
      zoomOnDoubleClick: true,
    },
    defaultNodeType: undefined,
  },
  catalog: { nodeTypes: [], edgeLabels: [] },
  propertySchemas: { node: {}, edge: {} },
  three: {
    linkDirectionalArrowLength: 8,
    linkOpacity: 0.55,
    edgeOpacityByLabel: {},
    layerOpacityByLayer: { '1': 1.0, '2': 0.9, '3': 0.8 },
    linkCurvature: 0.0,
    linkCurveRotation: 0.0,
    linkDirectionalArrowRelPos: 0.85,
    linkDirectionalParticles: 0,
    linkDirectionalParticleSpeed: 0.6,
    sphereRadius: 120,
    seed: 1,
    minSpacing: 0,
    nodeMotionIntensity: 1.0,
    minimapOpacity: 0.7,
    backgroundColor: '',
    fogColor: '',
    fogNear: 180,
    fogFar: 360,
    cameraDampingFactor: 0.08,
    cameraRotateSpeed: 0.6,
    cameraZoomSpeed: 0.8,
    cameraPanSpeed: 0.5,
    cameraAutoRotate: false,
    cameraAutoRotateSpeed: 0.4,
    nodeSizingFormula: 'schema',
    nodeImportanceSources: ['visual:importance'],
    edgeWidthFormula: 'schema',
    selection: {
      selectedNodeGlowIntensity: 0.8,
      dimmedNodeOpacity: 0.2,
      dimmedEdgeOpacity: 0.2,
      selectedEdgeWidth: 3,
    },
  },
  layers: {
    mode: 'property',
    documentStructure: {
      minGroupSize: 2,
    },
    semantic: {
      textKeys: ['chunk_text', 'text', 'code', 'heading'],
      minTokenLength: 3,
      maxTokensPerNode: 2000,
      stopwords: [],
      similarityMetric: 'cosine',
      similarityEdgeLabel: 'semanticSimilarity',
      topKEdgesPerNode: 4,
      minSimilarity: 0.12,
      communityDetection: {
        enabled: true,
        resolution: 1,
        maxPasses: 10,
        maxMovesPerPass: 20000,
      },
    },
  },
};

export function getNodeRadiusFromSchema(node: import('./types').GraphNode, schema: GraphSchema): number {
  const nodeSizes = schema.nodeSizes || {};
  const properties = node.properties || {};
  const sizingFormula = schema.three?.nodeSizingFormula || 'schema';
  if (sizingFormula === 'importance') {
    const importance = properties['visual:importance'];
    if (typeof importance === 'number' && Number.isFinite(importance) && importance > 0) {
      const radius = Math.sqrt(importance) * 2;
      const min = 10;
      const max = 40;
      const clamped = Math.max(min, Math.min(max, radius));
      if (Number.isFinite(clamped) && clamped > 0) {
        return clamped;
      }
    }
  }
  const rawSize = properties['visual:nodeSize'];
  if (typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0) {
    return rawSize;
  }
  const fallbackRadius = nodeSizes[node.type]?.radius;
  if (typeof fallbackRadius === 'number' && Number.isFinite(fallbackRadius) && fallbackRadius > 0) {
    return fallbackRadius;
  }
  return 10;
}
