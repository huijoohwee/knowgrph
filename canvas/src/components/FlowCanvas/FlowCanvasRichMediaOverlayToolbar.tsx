import React from 'react'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { buildSharedRichMediaOverlayControlProps, buildSharedRichMediaOverlayToolbarProps } from '@/components/FlowEditor/richMediaOverlayToolbarProps'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'
import { commitRichMediaPanelChange, type RichMediaPanelChange } from '@/lib/render/richMediaSsot'
import type { RichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'
import type { GraphData, GraphNode } from '@/lib/graph/types'

function readGraphNodes(graphData: GraphData | null | undefined): GraphNode[] {
  return Array.isArray(graphData?.nodes) ? graphData.nodes as GraphNode[] : []
}

function findGraphNode(graphData: GraphData | null | undefined, nodeId: string): GraphNode | null {
  const key = String(nodeId || '').trim()
  if (!key) return null
  const nodes = readGraphNodes(graphData)
  return nodes.find(item => String(item?.id || '').trim() === key) || null
}

function readNodeProperties(node: GraphNode | null | undefined, fallback?: Record<string, unknown>): Record<string, unknown> {
  const properties = node?.properties
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    return { ...(properties as Record<string, unknown>) }
  }
  return { ...(fallback || {}) }
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
  const graphData = useGraphStore(s => s.graphData)
  const node = React.useMemo(() => {
    return findGraphNode(graphData || props.sceneGraphData, props.nodeId)
  }, [graphData, props.nodeId, props.sceneGraphData])
  const toolbarProperties = React.useMemo(() => {
    return readNodeProperties(node, props.nodeProperties)
  }, [node, props.nodeProperties])
  const patchProperties = React.useCallback((patch: Record<string, unknown>) => {
    const key = String(props.nodeId || '').trim()
    if (!key || props.workspaceMutationBlockedRef.current) return
    const store = useGraphStore.getState()
    const currentNode = findGraphNode(store.graphData || props.sceneGraphData, key)
    const baseProperties = readNodeProperties(currentNode, props.nodeProperties)
    store.updateNode?.(key, {
      properties: { ...baseProperties, ...patch },
    } as Partial<GraphNode>)
  }, [props.nodeId, props.nodeProperties, props.sceneGraphData, props.workspaceMutationBlockedRef])
  const changePanel = React.useCallback((next: RichMediaPanelChange) => {
    const key = String(props.nodeId || '').trim()
    if (!key || props.workspaceMutationBlockedRef.current) return
    const store = useGraphStore.getState()
    commitRichMediaPanelChange({
      nodeId: key,
      next,
      updateNode: (id, patch) => store.updateNode?.(id, patch as Partial<GraphNode>),
    })
  }, [props.nodeId, props.workspaceMutationBlockedRef])
  const toolbarControlProps = React.useMemo(() => buildSharedRichMediaOverlayControlProps({
    properties: toolbarProperties,
    panel: props.panel,
    openUrl: props.openUrl,
    onPatchProperties: patchProperties,
    onPanelChange: changePanel,
  }), [changePanel, patchProperties, props.openUrl, props.panel, toolbarProperties])
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
    store.removeNode?.(key)
    store.addHistory?.('Rich Media remove')
  }, [props.nodeId, props.workspaceMutationBlockedRef])
  return (
    <NodeOverlayEditorActionsToolbar
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
