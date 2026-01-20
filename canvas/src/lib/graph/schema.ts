import type { GraphNode } from './types';
import type { GraphSchema, ThreeConfig, ThreeSelectionConfig, RendererPalette } from './schemaTypes';

// Re-export types and property helpers
export * from './schemaTypes';
export * from './schemaProperties';

export function getThreeConfig(schema: GraphSchema | null | undefined): ThreeConfig {
  const three = schema && schema.three;
  if (!three) return {};
  return three as ThreeConfig;
}

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
      : MVP_COLOR_PALETTE.nodes.idea;
  return {
    selectedNodeGlowIntensity,
    dimmedNodeOpacity,
    dimmedEdgeOpacity,
    selectedEdgeWidth,
    selectedEdgeColor,
  };
}

export const MVP_COLOR_PALETTE = {
  nodes: {
    idea: '#007BFF',
    hypothesis: '#FFC107',
    execution: '#28A745',
    pivot: '#FD7E14',
    alert: '#DC3545',
  },
  edges: {
    critical: '#DC3545',
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
    pointsTo: { color: MVP_COLOR_PALETTE.edges.neutral, width: 1.5, arrow: true },
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
  nodeShapes: { Image: 'rect' },
  edgeRouting: { mode: 'straight', curvatureByLabel: {} },
  layout: {
    mode: 'force',
    forces: {
      linkDistanceByLabel: { relatedTo: 80 },
      charge: -450,
      collisionByType: {},
      centerStrength: 1,
      alphaDecay: 0.02,
      bboxCollide: true,
      bboxCollideStrength: 0.7,
      bboxCollidePadding: 10,
      bboxCollideIterations: 1,
    },
    fitPadding: 80,
    fitUseCentroid: true,
    fitDetectClusters: true,
    fitTargetAspectRatio: 1.777,
    fitEnforceAspectRatio: true,
  },
  endpointMatrix: {},
  cardinality: { nodeType: {}, edgeLabel: {} },
  templates: { node: {}, edge: {} },
  performance: { lod: { hideLabelsBelowScale: 0.0 }, caps: { maxNodes: 0, maxEdges: 0 } },
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
    portHandles: {
      enabled: true,
      placement: 'cardinal',
      size: 4,
      offset: 2,
      strokeWidth: 1.5,
    },
    hover: {
      enabled: true,
      content: {
        showProps: true,
        showType: true,
        showId: true,
      }
    },
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
    linkCurvature: 0.0,
    linkCurveRotation: 0.0,
    linkDirectionalArrowRelPos: 0.85,
    linkDirectionalParticles: 0,
    linkDirectionalParticleSpeed: 0.6,
    sphereRadius: 120,
    seed: 1,
    minSpacing: 32,
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
      selectedEdgeColor: MVP_COLOR_PALETTE.nodes.idea,
    },
  },
};

export function getNodeRadiusFromSchema(node: GraphNode, schema: GraphSchema): number {
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
