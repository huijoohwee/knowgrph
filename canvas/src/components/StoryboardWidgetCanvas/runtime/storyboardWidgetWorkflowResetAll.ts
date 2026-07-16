import { normalizeAllStoryboardWidgetProbeTreeOutputLayouts } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetProbeTreeLayout'
import { clearRichMediaOutputProperties } from '@/features/chat/richMediaRun'
import type { GraphData } from '@/lib/graph/types'
import { areStoryboardWidgetWorkflowRecordValuesEqual } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowWriteback'

export type StoryboardWidgetWorkflowResetAllResult = {
  graphData: GraphData
  layoutChanged: boolean
  resetCount: number
}

export function buildStoryboardWidgetWorkflowResetAllGraphData(
  graphData: GraphData,
): StoryboardWidgetWorkflowResetAllResult {
  const normalizedGraphData = normalizeAllStoryboardWidgetProbeTreeOutputLayouts(graphData, {
    forceThreadLayout: true,
  })
  let resetCount = 0
  const nodes = (normalizedGraphData.nodes || []).map(node => {
    const currentProperties = (node.properties || {}) as Record<string, unknown>
    const nextProperties = clearRichMediaOutputProperties(currentProperties)
    if (areStoryboardWidgetWorkflowRecordValuesEqual(currentProperties, nextProperties)) return node
    resetCount += 1
    return { ...node, properties: nextProperties as never }
  })
  return {
    graphData: resetCount > 0 ? { ...normalizedGraphData, nodes } : normalizedGraphData,
    layoutChanged: normalizedGraphData !== graphData,
    resetCount,
  }
}
