import React from 'react'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { buildSharedRichMediaOverlayToolbarProps } from '@/components/FlowEditor/richMediaOverlayToolbarProps'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export function FlowCanvasRichMediaOverlayToolbar(props: {
  visible: boolean
  nodeId: string
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
  const duplicate = React.useCallback(() => {
    const key = String(props.nodeId || '').trim()
    if (!key || props.workspaceMutationBlockedRef.current) return
    const store = useGraphStore.getState()
    const graphData = store.graphData || props.sceneGraphData || null
    const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes as GraphNode[] : []
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
    store.removeNode?.(key)
    store.addHistory?.('Rich Media remove')
  }, [props.nodeId, props.workspaceMutationBlockedRef])
  return (
    <NodeOverlayEditorActionsToolbar
      visible={props.visible}
      {...buildSharedRichMediaOverlayToolbarProps()}
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
