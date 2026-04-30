import { syncGraphFieldsWithGraphData } from '@/hooks/store/graphDataSliceUtils'
import { createHistorySlice } from '@/hooks/store/historySlice'

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
