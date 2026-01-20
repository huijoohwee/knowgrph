import { normalized as normalizeText } from '@/features/panels/utils/json'
import { GraphData } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  canUseSchemaUiApplyRegistration,
  getSchemaUiApplyRegistrationSnapshot,
  isSchemaUiEditorOpenSnapshot,
  type SchemaUiApplyRegistration,
} from '@/features/schema-editor/useBottomPanelSchema'
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
    mode: 'force',
    forces: {
      linkDistanceByLabel: {},
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
