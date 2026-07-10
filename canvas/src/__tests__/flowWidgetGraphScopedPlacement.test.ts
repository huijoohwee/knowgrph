import type { StoreApi } from 'zustand'

import { createGraphViewSlice } from '@/hooks/store/graphViewSlice'
import type { GraphState } from '@/hooks/store/types'

export function testFlowWidgetPlacementWritesToExplicitGraphScope() {
  let state = {} as GraphState
  const set: StoreApi<GraphState>['setState'] = partial => {
    const next = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...next }
  }
  const get: StoreApi<GraphState>['getState'] = () => state
  state = {
    ...state,
    ...createGraphViewSlice(set, get),
    graphData: {
      type: 'Graph',
      context: '',
      metadata: { kind: 'render', source: 'transient' },
      nodes: [],
      edges: [],
    },
  } as GraphState

  const graphKey = 'document:canonical'
  state.setFlowWidgetPosByNodeIdForGraph(graphKey, {
    card: { top: 120, left: 240 },
  })
  state.setFlowWidgetWorldPosByNodeIdForGraph(graphKey, {
    card: { x: -80, y: 160 },
  })

  const scopedScreen = state.flowWidgetPosByNodeIdByGraphMetaKey[graphKey]?.card
  const scopedWorld = state.flowWidgetWorldPosByNodeIdByGraphMetaKey[graphKey]?.card
  if (scopedScreen?.top !== 120 || scopedScreen.left !== 240) {
    throw new Error(`expected screen placement in explicit graph scope, got ${JSON.stringify(scopedScreen || null)}`)
  }
  if (scopedWorld?.x !== -80 || scopedWorld.y !== 160) {
    throw new Error(`expected world placement in explicit graph scope, got ${JSON.stringify(scopedWorld || null)}`)
  }
  if (state.flowWidgetPosByNodeIdByGraphMetaKey['render:transient']?.card) {
    throw new Error('expected transient render graph to remain free of the canonical screen placement')
  }
  if (state.flowWidgetWorldPosByNodeIdByGraphMetaKey['render:transient']?.card) {
    throw new Error('expected transient render graph to remain free of the canonical world placement')
  }
}
