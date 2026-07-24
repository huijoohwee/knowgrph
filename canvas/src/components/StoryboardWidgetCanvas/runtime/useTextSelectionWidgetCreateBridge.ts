import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  buildTextSelectionWidgetEdge,
  clearTextSelectionWidgetLinkSession,
  isTextSelectionWidgetEdgePersisted,
  resolveTextSelectionWidgetTargetPosition,
  TEXT_SELECTION_WIDGET_CREATE_EVENT,
  type TextSelectionWidgetCreateDetail,
} from '@/lib/storyboardWidget/textSelectionWidgetLink'

export function useTextSelectionWidgetCreateBridge(args: {
  active: boolean
  widgetRegistryRef: React.MutableRefObject<ReadonlyArray<WidgetRegistryEntry>>
  resolveRegistryEntry: (
    registry: ReadonlyArray<WidgetRegistryEntry>,
    payload: {
      registryEntryId: string
      nodeTypeId: string
      widgetTypeId: string
      formId: string
    },
  ) => WidgetRegistryEntry | null
  addNodeFromRegistryAtWorld: (payload: {
    entry: WidgetRegistryEntry
    layoutVariantId?: unknown
    x: number
    y: number
  }) => string
}) {
  const {
    active,
    widgetRegistryRef,
    resolveRegistryEntry,
    addNodeFromRegistryAtWorld,
  } = args

  React.useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const onCreateTarget = (event: Event) => {
      const detail = (event as CustomEvent<TextSelectionWidgetCreateDetail>).detail
      if (!detail || detail.claimed) return
      const stateBefore = useGraphStore.getState()
      const graphBefore = stateBefore.graphData as GraphData | null
      if (!graphBefore) return
      const sourceNode = resolveGraphNodeByCanonicalId(graphBefore, detail.session.sourceNodeId)
      const entry = resolveRegistryEntry(widgetRegistryRef.current || [], detail.target)
      if (!sourceNode || !entry) return
      detail.claimed = true
      const position = resolveTextSelectionWidgetTargetPosition({ sourceNode })
      const targetNodeId = addNodeFromRegistryAtWorld({
        entry,
        layoutVariantId: detail.target.layoutVariantId,
        x: position.x,
        y: position.y,
      })
      const stateAfterNode = useGraphStore.getState()
      const graphAfterNode = stateAfterNode.graphData as GraphData | null
      const edge = graphAfterNode && targetNodeId
          ? buildTextSelectionWidgetEdge({
            graphData: graphAfterNode,
            session: {
              ...detail.session,
              sourceNodeId: sourceNode.id,
            },
            targetNodeId,
          })
        : null
      if (!edge) {
        stateAfterNode.upsertUiToast({
          id: 'rich-media-selection-widget-link-error',
          kind: 'error',
          message: 'The target Widget was created, but the selection edge could not be resolved.',
          ttlMs: 5000,
        })
        return
      }
      const duplicate = (graphAfterNode?.edges || []).some(candidate => candidate.id === edge.id)
      if (!duplicate) stateAfterNode.addEdge(edge)
      const graphAfterEdge = useGraphStore.getState().graphData as GraphData | null
      const edgePersisted = isTextSelectionWidgetEdgePersisted({
        graphData: graphAfterEdge,
        edge,
      })
      if (!edgePersisted) {
        useGraphStore.getState().upsertUiToast({
          id: 'rich-media-selection-widget-link-error',
          kind: 'error',
          message: 'The target Widget was created, but the graph rejected the selection edge.',
          ttlMs: 5000,
        })
        return
      }
      clearTextSelectionWidgetLinkSession()
      useGraphStore.getState().upsertUiToast({
        id: 'rich-media-selection-widget-link-complete',
        kind: 'success',
        message: `Created ${entry.nodeTypeId} and linked the selected text.`,
        ttlMs: 3000,
      })
    }
    window.addEventListener(TEXT_SELECTION_WIDGET_CREATE_EVENT, onCreateTarget)
    return () => window.removeEventListener(TEXT_SELECTION_WIDGET_CREATE_EVENT, onCreateTarget)
  }, [active, addNodeFromRegistryAtWorld, resolveRegistryEntry, widgetRegistryRef])
}
