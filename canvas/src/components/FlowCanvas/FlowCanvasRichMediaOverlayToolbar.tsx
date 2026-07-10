import React from 'react'
import { WidgetEditorActionsToolbar } from '@/components/StoryboardWidget/WidgetEditorActionsToolbar'
import { buildSharedRichMediaOverlayControlProps, buildSharedRichMediaOverlayToolbarProps } from '@/components/StoryboardWidget/richMediaOverlayToolbarProps'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'
import type { RichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { isCanonicalNodeIdEqual, resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { lsSetBool } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'

function readGraphNodes(graphData: GraphData | null | undefined): GraphNode[] {
  return Array.isArray(graphData?.nodes) ? graphData.nodes as GraphNode[] : []
}

function findGraphNode(graphData: GraphData | null | undefined, nodeId: string): GraphNode | null {
  const key = String(nodeId || '').trim()
  if (!key) return null
  const nodes = readGraphNodes(graphData)
  return nodes.find(item => String(item?.id || '').trim() === key) || null
}

export function resolveFlowCanvasRichMediaOverlayRemoval(args: {
  graphData: GraphData | null | undefined
  nodeId: unknown
  openWidgetNodeIds: ReadonlyArray<string>
  selectedNodeId: unknown
}): {
  targetNodeId: string
  nextOpenWidgetNodeIds: string[]
  clearSelection: boolean
} | null {
  const key = String(args.nodeId || '').trim()
  if (!key) return null
  const targetNode = resolveGraphNodeByCanonicalId(args.graphData, key) || findGraphNode(args.graphData, key)
  const targetNodeId = String(targetNode?.id || key).trim()
  const nextOpenWidgetNodeIds = args.openWidgetNodeIds.filter(nodeId => {
    return !isCanonicalNodeIdEqual(nodeId, key) && !isCanonicalNodeIdEqual(nodeId, targetNodeId)
  })
  const selectedNodeId = String(args.selectedNodeId || '').trim()
  return {
    targetNodeId,
    nextOpenWidgetNodeIds,
    clearSelection: isCanonicalNodeIdEqual(selectedNodeId, key) || isCanonicalNodeIdEqual(selectedNodeId, targetNodeId),
  }
}

export function FlowCanvasRichMediaOverlayToolbar(props: {
  visible: boolean
  nodeId: string
  nodeProperties: Record<string, unknown>
  panel?: RichMediaPanelOverlayState
  openUrl?: string
  sceneGraphData: GraphData | null
  workspaceMutationBlockedRef: React.MutableRefObject<boolean>
}) {
  const openInSidepane = React.useCallback(() => {
    const key = String(props.nodeId || '').trim()
    if (!key) return
    const store = useGraphStore.getState()
    store.setSelectionSource?.('canvas')
    store.selectNode?.(key)
    store.updateOpenWidgetNodeIds?.(prev => (prev.includes(key) ? prev : [...prev, key]))
  }, [props.nodeId])
  const toolbarControlProps = React.useMemo(() => buildSharedRichMediaOverlayControlProps({
    onSwitchToKtvRows: () => {
      lsSetBool(LS_KEYS.flowWidgetRichMediaKtvRows, true)
      openInSidepane()
    },
  }), [openInSidepane])
  const duplicate = React.useCallback(() => {
    const key = String(props.nodeId || '').trim()
    if (!key || props.workspaceMutationBlockedRef.current) return
    const store = useGraphStore.getState()
    const graphData = store.graphData || props.sceneGraphData || null
    const nodes = readGraphNodes(graphData)
    const node = nodes.find(item => String(item?.id || '').trim() === key)
    if (!node) return
    const usedIds = new Set(nodes.map(item => String(item?.id || '').trim()).filter(Boolean))
    const nextId = createUniqueId('n', usedIds)
    store.addNode?.({
      ...node,
      id: nextId,
      label: `${String(node.label || 'Rich Media Panel').trim()} Copy`,
      x: Number(node.x) + 32 || 32,
      y: Number(node.y) + 32 || 32,
      fx: undefined,
      fy: undefined,
      properties: { ...((node.properties || {}) as Record<string, unknown>) } as never,
    })
    store.addHistory?.('Rich Media duplicate')
  }, [props.nodeId, props.sceneGraphData, props.workspaceMutationBlockedRef])
  const remove = React.useCallback(() => {
    const key = String(props.nodeId || '').trim()
    if (!key || props.workspaceMutationBlockedRef.current) return
    const store = useGraphStore.getState()
    const graphData = store.graphData || props.sceneGraphData || null
    const removal = resolveFlowCanvasRichMediaOverlayRemoval({
      graphData,
      nodeId: key,
      openWidgetNodeIds: useGraphStore.getState().openWidgetNodeIds || [],
      selectedNodeId: useGraphStore.getState().selectedNodeId,
    })
    if (!removal) return
    store.removeNode?.(removal.targetNodeId)
    store.updateOpenWidgetNodeIds?.(() => removal.nextOpenWidgetNodeIds)
    if (removal.clearSelection) {
      store.setSelectionSource?.('canvas')
      store.selectNode?.(null)
      store.selectEdge?.(null)
    }
    store.addHistory?.('Rich Media remove')
  }, [props.nodeId, props.sceneGraphData, props.workspaceMutationBlockedRef])
  return (
    <WidgetEditorActionsToolbar
      visible={props.visible}
      {...buildSharedRichMediaOverlayToolbarProps()}
      {...toolbarControlProps}
      onRun={() => void 0}
      onOpenInSidepane={openInSidepane}
      onDuplicate={duplicate}
      onClearOutput={() => void 0}
      onHelp={() => void 0}
      onRemove={remove}
      onConvertToLoopNode={() => void 0}
    />
  )
}
