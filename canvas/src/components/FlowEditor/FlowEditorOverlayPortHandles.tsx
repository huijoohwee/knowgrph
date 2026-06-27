import React from 'react'

import { NodeOverlayEditorPortHandles } from '@/components/FlowEditor/NodeOverlayEditorPortHandles'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

type PortHandleInteractionContextValue = {
  active: boolean
  graphData: GraphData | null
  pendingEdgeSourceId: string | null
  registryEntries: ReadonlyArray<WidgetRegistryEntry>
  schema: GraphSchema | null
  toolMode: 'select' | 'addEdge'
  beginEdge: (nodeId: string, portKey?: string | null) => void
  finalizeEdge: (nodeId: string, portKey?: string | null) => void
}

const PortHandleInteractionContext = React.createContext<PortHandleInteractionContextValue | null>(null)

export function FlowEditorOverlayPortHandleProvider(props: React.PropsWithChildren<PortHandleInteractionContextValue>) {
  const { children, ...value } = props
  return <PortHandleInteractionContext.Provider value={value}>{children}</PortHandleInteractionContext.Provider>
}

export function FlowEditorOverlayPortHandles(props: {
  node?: GraphNode | null
  nodeId?: string
  selected: boolean
}) {
  const interaction = React.useContext(PortHandleInteractionContext)
  const nodeId = String(props.node?.id || props.nodeId || '').trim()
  const node = props.node || interaction?.graphData?.nodes?.find(candidate => String(candidate?.id || '').trim() === nodeId) || null
  const visible = props.selected || Boolean(interaction?.pendingEdgeSourceId)
  if (!interaction || !interaction.active || !visible || !node) return null

  return (
    <NodeOverlayEditorPortHandles
      active
      node={node}
      schema={interaction.schema}
      registryEntries={interaction.registryEntries}
      edges={interaction.graphData?.edges || []}
      minimized={false}
      forceEnabled
      toolMode={interaction.toolMode}
      pendingEdgeSourceId={interaction.pendingEdgeSourceId}
      onBeginAddEdgeFromNode={interaction.beginEdge}
      onFinalizeAddEdgeToNode={interaction.finalizeEdge}
    />
  )
}
