import { LS_KEYS } from '@/lib/config'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO } from '@/features/bottom-panel/constants'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import {
  buildDefaultVisibleColumns,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
} from '@/features/graph-data-table/graphDataTable'
import { computeDerivedFields, type GraphFieldSettingsById } from '@/features/graph-fields/graphFields'
import { BodyCell } from '@/features/graph-data-table/ui/GraphDataTableBody'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export function testBottomPanelCollapsePersistence() {
  if (LS_KEYS.bottomPanelCollapsed !== 'kg:ui:bottomPanel:collapsed') {
    throw new Error('bottomPanelCollapsed key mismatch')
  }
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })

  const state = useGraphStore.getState()
  state.setBottomPanelHeightRatio(0)
  state.setBottomPanelTab('nodes')

  storage.setItem(LS_KEYS.bottomPanelCollapsed, '1')

  openBottomPanel('schema')

  const stored = storage.getItem(LS_KEYS.bottomPanelCollapsed)
  if (stored !== '0') {
    throw new Error('bottom panel collapse flag not cleared on open')
  }
  const after = useGraphStore.getState()
  if (after.bottomPanelTab !== 'schema') {
    throw new Error('bottom panel tab not updated')
  }
  if (after.bottomPanelHeightRatio < DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO) {
    throw new Error('bottom panel height ratio not restored to default')
  }

  restore()
}

export function testGraphFieldsPruneOnGraphDataChange() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage, navigatorOnline: false })

  const state = useGraphStore.getState()
  const order: GraphDataTableColumnKey[] = ['kind', 'id', 'prop:node:name', 'prop:node:age']
  state.setGraphDataTableColumnOrder(order)

  const visible: GraphDataTableColumnVisibilityByKey = {
    ...buildDefaultVisibleColumns(),
    'prop:node:age': true,
  }
  state.setGraphDataTableVisibleColumns(visible)

  const settings: GraphFieldSettingsById = {
    'node:name': { displayName: 'Name', isHidden: false, fieldType: 'Single line text', isCustom: false },
    'node:age': { displayName: 'Age', isHidden: true, fieldType: 'Number', isCustom: false },
  }
  state.setGraphFieldSettingsById(settings)

  const graph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'A', properties: { name: 'Alice' } }],
    edges: [],
  }
  state.setGraphData(graph)

  const after = useGraphStore.getState()
  if (after.graphDataTableColumnOrder.includes('prop:node:age')) {
    throw new Error('stale property column order was not pruned after setGraphData')
  }
  if (after.graphDataTableVisibleColumns['prop:node:age'] === true) {
    throw new Error('stale property column visibility was not pruned after setGraphData')
  }
  if (after.graphFieldSettingsById['node:age']) {
    throw new Error('stale graph field settings were not pruned after setGraphData')
  }
  if (!after.graphDataTableColumnOrder.includes('prop:node:name')) {
    throw new Error('active property column order was incorrectly removed')
  }

  after.clearGraphData()
  const cleared = useGraphStore.getState()
  if (cleared.graphDataTableColumnOrder.some(k => String(k).startsWith('prop:'))) {
    throw new Error('property columns were not removed on clearGraphData')
  }
  if (Object.keys(cleared.graphFieldSettingsById || {}).length !== 0) {
    throw new Error('graph field settings were not cleared on clearGraphData')
  }
  const storedGraph = storage.getItem(LS_KEYS.graphData)
  if (storedGraph !== null) {
    throw new Error('graph data was not removed from storage on clearGraphData')
  }

  restore()
}

export function testGraphFieldsStorePopulatesDerivedFields() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage, navigatorOnline: false })

  const state = useGraphStore.getState()
  const graph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'A', properties: { name: 'Alice' } }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1', label: 'self', properties: { weight: 1 } }],
  }
  state.setGraphData(graph)
  const after = useGraphStore.getState()
  if (!after.graphData) {
    throw new Error('graphData should be set after setGraphData')
  }
  const derived = computeDerivedFields(after.graphData)
  if (!derived.length) {
    throw new Error('derived graph fields should not be empty after setting graphData')
  }
  if (!derived.some(f => f.id === 'node:name')) {
    throw new Error('derived graph fields missing node:name')
  }
  if (!derived.some(f => f.id === 'edge:weight')) {
    throw new Error('derived graph fields missing edge:weight')
  }
  if (after.graphDataTableVisibleColumns['prop:edge:weight'] !== true) {
    throw new Error('Graph Data Table did not mark prop:edge:weight as visible')
  }
  if (!after.graphDataTableColumnOrder.includes('prop:edge:weight')) {
    throw new Error('Graph Data Table column order missing prop:edge:weight')
  }

  restore()
}

export function testGraphFieldsSyncOnNodeAndEdgeMutations() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage, navigatorOnline: false })

  const state = useGraphStore.getState()
  state.resetAll()
  state.setGraphData({
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'A', properties: { name: 'Alice' } }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1', label: 'self', properties: { weight: 1 } }],
  })

  state.updateNode('n1', { properties: { name: 'Alice', age: 2 } })
  const afterAddNodeProp = useGraphStore.getState()
  if (afterAddNodeProp.graphDataTableVisibleColumns['prop:node:age'] !== true) {
    throw new Error('Graph Data Table did not sync prop:node:age visibility after updateNode')
  }
  if (!afterAddNodeProp.graphDataTableColumnOrder.includes('prop:node:age')) {
    throw new Error('Graph Data Table did not sync prop:node:age column order after updateNode')
  }

  state.updateNode('n1', { properties: { name: 'Alice' } })
  const afterRemoveNodeProp = useGraphStore.getState()
  if (afterRemoveNodeProp.graphDataTableColumnOrder.includes('prop:node:age')) {
    throw new Error('Graph Data Table did not prune prop:node:age column order after updateNode')
  }
  if (afterRemoveNodeProp.graphDataTableVisibleColumns['prop:node:age'] === true) {
    throw new Error('Graph Data Table did not prune prop:node:age visibility after updateNode')
  }

  state.updateEdge('e1', { properties: { weight: 1, strength: 3 } })
  const afterAddEdgeProp = useGraphStore.getState()
  if (afterAddEdgeProp.graphDataTableVisibleColumns['prop:edge:strength'] !== true) {
    throw new Error('Graph Data Table did not sync prop:edge:strength visibility after updateEdge')
  }
  if (!afterAddEdgeProp.graphDataTableColumnOrder.includes('prop:edge:strength')) {
    throw new Error('Graph Data Table did not sync prop:edge:strength column order after updateEdge')
  }

  state.updateEdge('e1', { properties: { weight: 1 } })
  const afterRemoveEdgeProp = useGraphStore.getState()
  if (afterRemoveEdgeProp.graphDataTableColumnOrder.includes('prop:edge:strength')) {
    throw new Error('Graph Data Table did not prune prop:edge:strength column order after updateEdge')
  }
  if (afterRemoveEdgeProp.graphDataTableVisibleColumns['prop:edge:strength'] === true) {
    throw new Error('Graph Data Table did not prune prop:edge:strength visibility after updateEdge')
  }

  restore()
}

export function testGraphFieldsSyncOnEdgePropertiesEditViaTableUi() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage, navigatorOnline: false })

  const state = useGraphStore.getState()
  state.resetAll()
  state.setGraphData({
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'A', properties: { name: 'Alice' } }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1', label: 'self', properties: { weight: 1 } }],
  })

  const before = useGraphStore.getState()
  if (before.graphDataTableColumnOrder.includes('prop:edge:strength')) {
    throw new Error('Precondition failed: prop:edge:strength already present in column order')
  }
  if (before.graphDataTableVisibleColumns['prop:edge:strength'] === true) {
    throw new Error('Precondition failed: prop:edge:strength already visible')
  }

  const edge = before.graphData?.edges?.find(e => e.id === 'e1')
  if (!edge) {
    throw new Error('Precondition failed: missing test edge')
  }

  const BodyCellImpl =
    (BodyCell as unknown as { type?: (props: unknown) => unknown }).type ??
    (BodyCell as unknown as (props: unknown) => unknown)

  const row = {
    kind: 'edge',
    id: edge.id,
    label: edge.label,
    source: edge.source,
    target: edge.target,
    properties: edge.properties,
    metadata: edge.metadata,
  } as const

  const tdEl = BodyCellImpl({
    columnKey: 'properties',
    row,
    isActive: true,
    rowDensity: 'expanded',
    expandedCellRowId: null,
    expandedCellColumnKey: null,
    bodyCellBaseClassName: '',
    textInputClassName: '',
    monoTextInputClassName: '',
    uiPanelMonospaceTextClass: '',
    activeNode: undefined,
    activeEdge: edge,
    updateNode: () => void 0,
    updateEdge: (id: string, patch: { properties?: unknown }) => {
      state.updateEdge(id, patch as never)
    },
    freezeFirstDataColumn: 'none',
    showFrozenResizeHandle: false,
    fieldSettingsByColumnKey: new Map(),
  }) as unknown as { props?: { children?: unknown } }

  const cellEditorEl = tdEl?.props?.children as unknown as { props?: { onSave?: unknown } } | undefined
  const onSave = cellEditorEl?.props?.onSave as unknown as
    | ((val: { [key: string]: unknown }) => void)
    | undefined
  if (typeof onSave !== 'function') {
    throw new Error('Expected BodyCell(properties) to render an editable JSON cell when active')
  }

  onSave({ weight: 1, strength: 3 })

  const after = useGraphStore.getState()
  if (!after.graphData) {
    throw new Error('Expected graphData to remain set after editing edge properties')
  }
  const derived = computeDerivedFields(after.graphData)
  if (!derived.some(f => f.id === 'edge:strength')) {
    throw new Error('Graph Fields did not derive edge:strength after editing properties via table UI')
  }
  if (after.graphDataTableVisibleColumns['prop:edge:strength'] !== true) {
    throw new Error('Graph Data Table did not sync prop:edge:strength visibility after table UI edit')
  }
  if (!after.graphDataTableColumnOrder.includes('prop:edge:strength')) {
    throw new Error('Graph Data Table did not sync prop:edge:strength column order after table UI edit')
  }

  restore()
}

export function testGraphFieldsSyncOnHistoryUndoRedo() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage, navigatorOnline: false })

  const state = useGraphStore.getState()
  state.resetAll()
  state.setGraphData({
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Person', label: 'A', properties: { name: 'Alice' } }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1', label: 'self', properties: { weight: 1 } }],
  })
  state.addHistory('start')

  state.updateNode('n1', { properties: { name: 'Alice', age: 2 } })
  state.updateEdge('e1', { properties: { weight: 1, strength: 3 } })
  state.addHistory('add age and strength')

  const afterAdd = useGraphStore.getState()
  if (afterAdd.graphDataTableVisibleColumns['prop:node:age'] !== true) {
    throw new Error('Graph Data Table did not sync prop:node:age visibility before undo')
  }
  if (!afterAdd.graphDataTableColumnOrder.includes('prop:node:age')) {
    throw new Error('Graph Data Table did not sync prop:node:age column order before undo')
  }
  if (afterAdd.graphDataTableVisibleColumns['prop:edge:strength'] !== true) {
    throw new Error('Graph Data Table did not sync prop:edge:strength visibility before undo')
  }
  if (!afterAdd.graphDataTableColumnOrder.includes('prop:edge:strength')) {
    throw new Error('Graph Data Table did not sync prop:edge:strength column order before undo')
  }

  state.undoHistory()
  const afterUndo = useGraphStore.getState()
  if (afterUndo.graphDataTableColumnOrder.includes('prop:node:age')) {
    throw new Error('Graph Data Table did not prune prop:node:age column order after undo')
  }
  if (afterUndo.graphDataTableVisibleColumns['prop:node:age'] === true) {
    throw new Error('Graph Data Table did not prune prop:node:age visibility after undo')
  }
  if (afterUndo.graphDataTableColumnOrder.includes('prop:edge:strength')) {
    throw new Error('Graph Data Table did not prune prop:edge:strength column order after undo')
  }
  if (afterUndo.graphDataTableVisibleColumns['prop:edge:strength'] === true) {
    throw new Error('Graph Data Table did not prune prop:edge:strength visibility after undo')
  }

  state.redoHistory()
  const afterRedo = useGraphStore.getState()
  if (afterRedo.graphDataTableVisibleColumns['prop:node:age'] !== true) {
    throw new Error('Graph Data Table did not restore prop:node:age visibility after redo')
  }
  if (!afterRedo.graphDataTableColumnOrder.includes('prop:node:age')) {
    throw new Error('Graph Data Table did not restore prop:node:age column order after redo')
  }
  if (afterRedo.graphDataTableVisibleColumns['prop:edge:strength'] !== true) {
    throw new Error('Graph Data Table did not restore prop:edge:strength visibility after redo')
  }
  if (!afterRedo.graphDataTableColumnOrder.includes('prop:edge:strength')) {
    throw new Error('Graph Data Table did not restore prop:edge:strength column order after redo')
  }

  restore()
}

export function testSelectionClearsWhenRemovingSelectedNodeOrEdge() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage, navigatorOnline: false })

  const state = useGraphStore.getState()
  state.resetAll()
  state.setGraphData({
    type: 'Graph',
    nodes: [
      { id: 'n1', type: 'Person', label: 'A', properties: {} },
      { id: 'n2', type: 'Person', label: 'B', properties: {} },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'self', properties: {} }],
  })

  state.selectNode('n1')
  state.selectEdge('e1')
  state.removeNode('n1')

  const afterRemoveNode = useGraphStore.getState()
  if (afterRemoveNode.selectedNodeId !== null) {
    throw new Error('selectedNodeId should clear after removeNode')
  }
  if (afterRemoveNode.selectedEdgeId !== null) {
    throw new Error('selectedEdgeId should clear after removeNode removes selected edge')
  }

  state.setGraphData({
    type: 'Graph',
    nodes: [
      { id: 'n1', type: 'Person', label: 'A', properties: {} },
      { id: 'n2', type: 'Person', label: 'B', properties: {} },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'self', properties: {} }],
  })
  state.selectEdge('e1')
  state.removeEdge('e1')

  const afterRemoveEdge = useGraphStore.getState()
  if (afterRemoveEdge.selectedEdgeId !== null) {
    throw new Error('selectedEdgeId should clear after removeEdge')
  }

  restore()
}

export function testGraphDataTableAggregateDefaultVizModePersistence() {
  if (LS_KEYS.graphDataTableAggregateDefaultVizMode !== 'kg:graphDataTable:aggregateDefaultVizMode') {
    throw new Error('graphDataTableAggregateDefaultVizMode key mismatch')
  }

  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage, navigatorOnline: false })

  const state = useGraphStore.getState()
  if (state.graphDataTableAggregateDefaultVizMode !== 'radial') {
    throw new Error('graphDataTableAggregateDefaultVizMode should default to radial')
  }

  state.setGraphDataTableAggregateDefaultVizMode('none')
  const afterNone = useGraphStore.getState()
  if (afterNone.graphDataTableAggregateDefaultVizMode !== 'none') {
    throw new Error('graphDataTableAggregateDefaultVizMode did not update to none')
  }

  const storedNone = storage.getItem(LS_KEYS.graphDataTableAggregateDefaultVizMode)
  if (!storedNone) {
    throw new Error('graphDataTableAggregateDefaultVizMode was not persisted for none')
  }
  if (storedNone !== JSON.stringify('none')) {
    throw new Error('graphDataTableAggregateDefaultVizMode storage value for none is not JSON string')
  }

  state.setGraphDataTableAggregateDefaultVizMode('radial')
  const afterRadial = useGraphStore.getState()
  if (afterRadial.graphDataTableAggregateDefaultVizMode !== 'radial') {
    throw new Error('graphDataTableAggregateDefaultVizMode did not update back to radial')
  }

  const storedRadial = storage.getItem(LS_KEYS.graphDataTableAggregateDefaultVizMode)
  if (!storedRadial) {
    throw new Error('graphDataTableAggregateDefaultVizMode was not persisted for radial')
  }
  if (storedRadial !== JSON.stringify('radial')) {
    throw new Error('graphDataTableAggregateDefaultVizMode storage value for radial is not JSON string')
  }

  restore()
}
