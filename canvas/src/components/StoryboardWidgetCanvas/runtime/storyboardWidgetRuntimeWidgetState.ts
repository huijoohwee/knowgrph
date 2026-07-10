import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/storyboardWidget/widgetStateScope'
import { buildGraphDocumentMetaKey } from '@/lib/graph/graphMetaKey'

export type FlowWidgetWorldPosById = Record<string, { x: number; y: number }>
export type FlowWidgetScreenPosById = Record<string, { top: number; left: number }>
export type FlowWidgetPinnedById = Record<string, boolean>

export function readStoryboardWidgetGeometryStateSignature(state: {
  flowWidgetPosByNodeId?: unknown
  flowWidgetPosByNodeIdByGraphMetaKey?: unknown
  flowWidgetWorldPosByNodeId?: unknown
  flowWidgetWorldPosByNodeIdByGraphMetaKey?: unknown
}): string {
  return JSON.stringify({
    pos: state.flowWidgetPosByNodeId || {},
    posByGraphMetaKey: state.flowWidgetPosByNodeIdByGraphMetaKey || {},
    world: state.flowWidgetWorldPosByNodeId || {},
    worldByGraphMetaKey: state.flowWidgetWorldPosByNodeIdByGraphMetaKey || {},
  })
}

export function useStoryboardWidgetStateDependencyCounts() {
  const state = useGraphStore(useShallow(s => ({
    graphData: s.graphData,
    world: (s as unknown as { flowWidgetWorldPosByNodeId?: FlowWidgetWorldPosById }).flowWidgetWorldPosByNodeId,
    worldByGraph: (s as unknown as { flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, FlowWidgetWorldPosById> }).flowWidgetWorldPosByNodeIdByGraphMetaKey,
    pinned: s.flowWidgetPinnedByNodeId,
    pinnedByGraph: (s as unknown as { flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, FlowWidgetPinnedById> }).flowWidgetPinnedByNodeIdByGraphMetaKey,
  })))
  const graphKey = React.useMemo(() => buildGraphDocumentMetaKey(state.graphData), [state.graphData])
  const flowWidgetWorldPosCount = React.useMemo(() => Object.keys(resolveScopedFlowWidgetNodeMap({
    graphMetaKey: graphKey,
    keyedByGraphMetaKey: state.worldByGraph,
    globalByNodeId: state.world,
  })).length, [graphKey, state.world, state.worldByGraph])
  const flowWidgetPinnedCount = React.useMemo(() => Object.keys(resolveScopedFlowWidgetNodeMap({
    graphMetaKey: graphKey,
    keyedByGraphMetaKey: state.pinnedByGraph,
    globalByNodeId: state.pinned,
  })).length, [graphKey, state.pinned, state.pinnedByGraph])
  return { flowWidgetPinnedCount, flowWidgetWorldPosCount }
}
