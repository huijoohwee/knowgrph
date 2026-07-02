import type { GraphNode } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'

export type StoryboardUpdateKvEntryActionResult = {
  sourceNodeId: string | null
}

export function runStoryboardUpdateKvEntryAction(args: {
  sourceNode: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
  openMappingForNode: (args: {
    node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
    registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
    graphMetaKind?: string | null | undefined
  }) => void
}): StoryboardUpdateKvEntryActionResult {
  args.openMappingForNode({
    node: args.sourceNode,
    registry: args.registry,
    graphMetaKind: args.graphMetaKind,
  })
  return {
    sourceNodeId: String(args.sourceNode?.id || '').trim() || null,
  }
}
