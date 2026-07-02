import { convertNodeToLoopInGraphData } from '@/lib/storyboardWidget/storyboardWidgetActions'
import type { GraphData } from '@/lib/graph/types'

export type StoryboardConvertLoopActionResult =
  | {
      status: 'unavailable'
      changed: false
      graphData: null
    }
  | {
      status: 'already-loop'
      changed: false
      graphData: GraphData
    }
  | {
      status: 'converted'
      changed: true
      graphData: GraphData
    }

export function runStoryboardConvertLoopAction(args: {
  graphData: GraphData | null | undefined
  hasSourceNode: boolean
  resolvedCardNodeId: string
}): StoryboardConvertLoopActionResult {
  if (!args.graphData || !args.hasSourceNode) {
    return {
      status: 'unavailable',
      changed: false,
      graphData: null,
    }
  }
  const converted = convertNodeToLoopInGraphData(args.graphData, args.resolvedCardNodeId)
  if (!converted.changed) {
    return {
      status: 'already-loop',
      changed: false,
      graphData: converted.graphData,
    }
  }
  return {
    status: 'converted',
    changed: true,
    graphData: converted.graphData,
  }
}
