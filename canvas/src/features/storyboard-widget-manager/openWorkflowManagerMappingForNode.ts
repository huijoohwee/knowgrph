import type { GraphNode } from '@/lib/graph/types'
import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'
import { resolveWidgetIdentity, resolveWidgetRegistryEntry } from '@/features/storyboard-widget-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'

export function openWorkflowManagerMappingForNode(args: {
  node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
}): void {
  const resolvedWidgetRegistryEntry = resolveWidgetRegistryEntry({
    node: args.node,
    registry: args.registry,
    graphMetaKind: args.graphMetaKind,
  })
  const widgetIdentity = resolveWidgetIdentity({
    node: args.node,
    registryEntry: resolvedWidgetRegistryEntry,
  })
  const searchQuery = [
    String(resolvedWidgetRegistryEntry?.id || '').trim(),
    String(args.node?.type || '').trim(),
    widgetIdentity.widgetTypeId,
    widgetIdentity.formId,
  ].filter(Boolean).join(' ')
  emitMainPanelOpen({
    tab: 'workflowManager' as const,
    workflowManagerTab: 'mapping' as const,
    ...(searchQuery ? { searchQuery } : {}),
  })
}
