import { syncGraphFieldsWithGraphData } from '@/hooks/store/graphDataSliceUtils'
import { cancelScheduledHistoryCommit, createHistorySlice } from '@/hooks/store/historySlice'
import type { GraphData } from '@/lib/graph/types'

export function testSyncGraphFieldsAvoidsRedundantStoreSets() {
  const graphData = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 't' },
    nodes: [
      { id: 'a', type: 'Node', label: 'A', properties: { category: 'source', value: 1 } },
      { id: 'b', type: 'Node', label: 'B', properties: { category: 'sink', value: 2 } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', label: '', properties: { weight: 1 } }],
  } as const

  let orderSets = 0
  let visibleSets = 0
  let settingsSets = 0

  const state = {
    schema: {},
    graphFieldSettingsById: {} as Record<string, unknown>,
    graphDataTableColumnOrder: [] as unknown[],
    graphDataTableVisibleColumns: {} as Record<string, boolean | undefined>,
    setGraphDataTableColumnOrder: (next: unknown) => {
      orderSets += 1
      state.graphDataTableColumnOrder = Array.isArray(next) ? next : []
    },
    setGraphDataTableVisibleColumns: (next: unknown) => {
      visibleSets += 1
      state.graphDataTableVisibleColumns = (next && typeof next === 'object' && !Array.isArray(next)) ? (next as Record<string, boolean | undefined>) : {}
    },
    setGraphFieldSettingsById: (next: unknown) => {
      settingsSets += 1
      state.graphFieldSettingsById = (next && typeof next === 'object' && !Array.isArray(next)) ? (next as Record<string, unknown>) : {}
    },
  }

  const get = (() => state) as never

  syncGraphFieldsWithGraphData(get, graphData as never)
  const afterFirst = { orderSets, visibleSets, settingsSets }
  if (afterFirst.orderSets !== 1 || afterFirst.visibleSets !== 1) {
    throw new Error(`expected initial sync to set order+visible at least once, got ${JSON.stringify(afterFirst)}`)
  }

  syncGraphFieldsWithGraphData(get, graphData as never)
  const afterSecond = { orderSets, visibleSets, settingsSets }
  if (
    afterSecond.orderSets !== afterFirst.orderSets ||
    afterSecond.visibleSets !== afterFirst.visibleSets ||
    afterSecond.settingsSets !== afterFirst.settingsSets
  ) {
    throw new Error(`expected second sync to do nothing, got ${JSON.stringify({ afterFirst, afterSecond })}`)
  }
}

export function testHistorySliceSkipsRedundantSemanticSnapshots() {
  const graphData = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 't' },
    nodes: [{ id: 'a', type: 'Node', label: 'A', properties: { value: 1 } }],
    edges: [],
  } as const

  const state = {
    graphData,
    graphDataRevision: 1,
    graphFieldSettingsById: {},
    history: [] as Array<unknown>,
    historyIndex: -1,
    historyDebounceMs: 0,
    setGraphFieldSettingsById: (_next: unknown) => void 0,
    resyncGraphFieldsFromGraphData: () => void 0,
  }

  const setState = (next: Record<string, unknown>) => {
    Object.assign(state, next)
  }

  const getState = (() => state) as never
  const slice = createHistorySlice(setState as never, getState)

  slice.addHistory('Snapshot')
  const firstLen = state.history.length
  slice.addHistory('Snapshot')
  const secondLen = state.history.length

  if (firstLen !== 1 || secondLen !== 1) {
    throw new Error(`expected history slice to skip redundant semantic snapshots, got lengths ${firstLen} -> ${secondLen}`)
  }
}

export function testHistorySliceOnlyAdvancesRestoreRevisionForExplicitNavigation() {
  const firstGraph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'a', type: 'Node', label: 'A', properties: { value: 1 } }],
    edges: [],
  }
  const secondGraph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'b', type: 'Node', label: 'B', properties: { value: 2 } }],
    edges: [],
  }
  const state = {
    graphData: firstGraph,
    graphDataRevision: 1,
    graphContentRevision: 0,
    docLocationRevision: 0,
    markdownDocumentApplyRevision: 0,
    graphFieldSettingsById: {},
    history: [] as Array<unknown>,
    historyIndex: -1,
    historyRestoreRevision: 0 as number,
    historyDebounceMs: 0,
    markdownDocumentName: null,
    markdownDocumentText: null,
    sourceFiles: [] as Array<unknown>,
    resyncGraphFieldsFromGraphData: () => void 0,
  }
  const setState = (next: Record<string, unknown> | ((current: typeof state) => Record<string, unknown>)) => {
    Object.assign(state, typeof next === 'function' ? next(state) : next)
  }
  const slice = createHistorySlice(setState as never, (() => state) as never)

  slice.addHistory('First snapshot')
  state.graphData = secondGraph
  state.graphDataRevision = 2
  slice.addHistory('Second snapshot')
  if (state.historyRestoreRevision !== 0) {
    throw new Error('expected ordinary history snapshot commits to leave restore revision unchanged')
  }

  slice.restoreHistory(0)
  if (Number(state.historyRestoreRevision) !== 1 || String(state.graphData.nodes[0]?.id || '') !== 'a') {
    throw new Error('expected explicit history restore to advance restore revision and restore the selected graph')
  }
  slice.redoHistory()
  if (Number(state.historyRestoreRevision) !== 2 || String(state.graphData.nodes[0]?.id || '') !== 'b') {
    throw new Error('expected Redo to advance the restore-only revision independently of history snapshot recording')
  }
  slice.undoHistory()
  if (Number(state.historyRestoreRevision) !== 3 || String(state.graphData.nodes[0]?.id || '') !== 'a') {
    throw new Error('expected Undo to advance the restore-only revision independently of history snapshot recording')
  }
  slice.replaceHistoryState(state.history as never, 1)
  if (Number(state.historyRestoreRevision) !== 4 || String(state.graphData.nodes[0]?.id || '') !== 'b') {
    throw new Error('expected hydration onto a selected history entry to advance the restore-only revision')
  }
}

export async function testHistorySliceCanCancelPendingScheduledCommitBeforeReset() {
  const state = {
    graphData: {
      type: 'Graph',
      nodes: [{ id: 'a', type: 'Node', label: 'A', properties: {} }],
      edges: [],
    } as GraphData,
    graphDataRevision: 1,
    graphContentRevision: 0,
    docLocationRevision: 0,
    markdownDocumentApplyRevision: 0,
    graphFieldSettingsById: {},
    history: [] as Array<unknown>,
    historyIndex: -1,
    historyRestoreRevision: 0,
    historyDebounceMs: 25,
    markdownDocumentName: null,
    markdownDocumentText: null,
    sourceFiles: [] as Array<unknown>,
    resyncGraphFieldsFromGraphData: () => void 0,
  }
  const setState = (next: Record<string, unknown> | ((current: typeof state) => Record<string, unknown>)) => {
    Object.assign(state, typeof next === 'function' ? next(state) : next)
  }
  const slice = createHistorySlice(setState as never, (() => state) as never)

  slice.scheduleHistory('Pending snapshot')
  cancelScheduledHistoryCommit()
  await new Promise(resolve => setTimeout(resolve, 50))
  if (state.history.length !== 0 || state.historyIndex !== -1) {
    throw new Error('expected reset-owned history cancellation to prevent a pending debounce from repopulating cleared history')
  }
}
