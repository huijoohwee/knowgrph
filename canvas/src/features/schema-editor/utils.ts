import { normalized as normalizeText } from '@/features/panels/utils/json'
import { GraphData } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  DEFAULT_ALPHA_DECAY,
  DEFAULT_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_BBOX_COLLIDE_PADDING,
  DEFAULT_BBOX_COLLIDE_STRENGTH,
  DEFAULT_CENTER_STRENGTH,
  DEFAULT_CHARGE,
  DEFAULT_FIT_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
  DEFAULT_GROUP_CORNER_RADIUS,
  DEFAULT_GROUP_FILL_OPACITY,
  DEFAULT_GROUP_LABEL_PADDING,
  DEFAULT_GROUP_PADDING,
  DEFAULT_GROUPS_ENABLED,
  DEFAULT_GROUP_SHAPE,
  DEFAULT_GROUP_STROKE_WIDTH,
} from '@/lib/graph/layoutDefaults'
import {
  canUseSchemaUiApplyRegistration,
  getSchemaUiApplyRegistrationSnapshot,
  isSchemaUiEditorOpenSnapshot,
  type SchemaUiApplyRegistration,
} from '@/features/schema-editor/useWorkflowManagerSchema'
import { uniqueNodeTypes as deriveUniqueNodeTypes, uniqueEdgeLabels as deriveUniqueEdgeLabels } from '@/features/schema/derive'

export const normalizeQuery = (q?: string): string => normalizeText(q || '').trim()

export const filterStringsByQuery = (list: string[], normalizedQuery: string): string[] =>
  normalizedQuery ? list.filter(t => normalizeText(t).includes(normalizedQuery)) : list

export const computeFilteredLists = (data: GraphData | null, schema: GraphSchema, query?: string) => {
  const uNodes = deriveUniqueNodeTypes(data, schema)
  const uEdges = deriveUniqueEdgeLabels(data, schema)
  const normalized = normalizeQuery(query)
  const fNodes = filterStringsByQuery(uNodes, normalized)
  const fEdges = filterStringsByQuery(uEdges, normalized)
  return {
    uniqueNodeTypes: uNodes,
    uniqueEdgeLabels: uEdges,
    filteredNodeTypes: fNodes,
    filteredEdgeLabels: fEdges,
    normalized,
  }
}

export const buildCleanSchema = (): GraphSchema => ({
  nodeStyles: {},
  edgeStyles: {},
  nodeSizes: {},
  nodeStroke: {},
  labelStyles: { fontSize: 12, offset: { dx: 12, dy: 4 } },
  nodeShapes: {},
  edgeRouting: { mode: 'straight', curvatureByLabel: {} },
  layout: {
    mode: 'radial',
    forces: {
      linkDistanceByLabel: {},
      charge: DEFAULT_CHARGE,
      collisionByType: {},
      centerStrength: DEFAULT_CENTER_STRENGTH,
      alphaDecay: DEFAULT_ALPHA_DECAY,
      bboxCollide: true,
      bboxCollideStrength: DEFAULT_BBOX_COLLIDE_STRENGTH,
      bboxCollidePadding: DEFAULT_BBOX_COLLIDE_PADDING,
      bboxCollideIterations: DEFAULT_BBOX_COLLIDE_ITERATIONS,
      groupBboxCollide: true,
      groupBboxCollideStrength: DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
      groupBboxCollidePadding: DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
      groupBboxCollideIterations: DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
    },
    fitPadding: DEFAULT_FIT_PADDING,
    groups: {
      enabled: DEFAULT_GROUPS_ENABLED,
      shape: DEFAULT_GROUP_SHAPE,
      padding: DEFAULT_GROUP_PADDING,
      cornerRadius: DEFAULT_GROUP_CORNER_RADIUS,
      labelPadding: DEFAULT_GROUP_LABEL_PADDING,
      strokeWidth: DEFAULT_GROUP_STROKE_WIDTH,
      fillOpacity: DEFAULT_GROUP_FILL_OPACITY,
    },
  },
  endpointMatrix: {},
  cardinality: { nodeType: {}, edgeLabel: {} },
  templates: { node: {}, edge: {} },
  performance: { lod: { hideLabelsBelowScale: 0 }, caps: { maxNodes: 0, maxEdges: 0 } },
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
  },
  catalog: { nodeTypes: [], edgeLabels: [] },
  propertySchemas: { node: {}, edge: {} },
})

export const toSchemaImportFileName = (label?: string | null): string => {
  const clean = typeof label === 'string' ? label.trim() : ''
  if (!clean) return ''
  const parts = clean.split(/[/\\]/)
  const last = parts[parts.length - 1]
  return last || clean
}

type SchemaEditorSnapshotsModule = {
  getSchemaUiApplyRegistrationSnapshot: () => SchemaUiApplyRegistration | null
  isSchemaUiEditorOpenSnapshot: () => boolean
  canUseSchemaUiApplyRegistration: (reg: SchemaUiApplyRegistration | null, currentSchemaHash: string) => boolean
}

type GraphStoreModule = {
  useGraphStore: {
    getState: () => { schema: unknown }
  }
}

const resolveSchemaEditorSnapshots = (): SchemaEditorSnapshotsModule => {
  const anyGlobal = globalThis as unknown as {
    __kgTestMocks__?: {
      schemaEditorSnapshots?: SchemaEditorSnapshotsModule
    }
  }

  const mocks = anyGlobal.__kgTestMocks__?.schemaEditorSnapshots
  if (mocks) return mocks

  return {
    getSchemaUiApplyRegistrationSnapshot,
    isSchemaUiEditorOpenSnapshot,
    canUseSchemaUiApplyRegistration,
  }
}

const resolveGraphStore = (): GraphStoreModule => {
  const anyGlobal = globalThis as unknown as {
    __kgTestMocks__?: {
      graphStore?: GraphStoreModule
    }
  }

  const mocks = anyGlobal.__kgTestMocks__?.graphStore
  if (mocks) return mocks

  return {
    useGraphStore,
  }
}

export const applySchemaUiSnapshotIfNeeded = (): void => {
  const snapshots = resolveSchemaEditorSnapshots()
  const graphStoreModule = resolveGraphStore()

  const reg = snapshots.getSchemaUiApplyRegistrationSnapshot()
  if (!reg) return
  if (!snapshots.isSchemaUiEditorOpenSnapshot()) return

  const computeStoreSchemaHash = (): string => {
    try {
      return JSON.stringify(graphStoreModule.useGraphStore.getState().schema)
    } catch {
      return ''
    }
  }

  const currentHash = computeStoreSchemaHash()
  if (!snapshots.canUseSchemaUiApplyRegistration(reg, currentHash)) return

  try {
    reg.apply()
  } catch {
    void 0
  }
}
