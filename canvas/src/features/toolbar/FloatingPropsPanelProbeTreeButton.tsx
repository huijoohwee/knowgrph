import React from 'react'

import { materializeProbeTreeBranchCardsFromGraphNode } from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import FloatingPropsPanelMenuButton from '@/features/toolbar/FloatingPropsPanelMenuButton'

type FloatingPropsPanelProbeTreeButtonProps = {
  disabled: boolean
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
}

export default function FloatingPropsPanelProbeTreeButton(props: FloatingPropsPanelProbeTreeButtonProps) {
  const selectedNodeId = useGraphStore(state => state.selectedNodeId)

  const handleInvokeProbeTree = React.useCallback(() => {
    const store = useGraphStore.getState()
    const activeNodeId = store.selectedNodeId || selectedNodeId
    const graphData = store.graphData
    const node = activeNodeId
      ? (graphData?.nodes || []).find(candidate => String(candidate.id || '') === activeNodeId) || null
      : null
    const result = materializeProbeTreeBranchCardsFromGraphNode({ graphData, node })

    if (result.changed && result.graphData) {
      store.setGraphDataPreservingLayout(result.graphData)
      store.addHistory('Props Panel Probe-Tree branch cards')
    }
    if (result.materializedNodeIds.length > 0) {
      store.setSelectionSource('toolbar')
      store.selectNodesExpanded({
        nodeIds: result.materializedNodeIds,
        activeNodeId: result.materializedNodeIds[0],
      })
    }
    try {
      store.pushUiToast({
        id: 'probe-tree:props-panel-materialize',
        kind: result.kind,
        message: result.message,
        dismissible: result.kind !== 'success',
        ttlMs: result.kind === 'success' ? 2600 : 4000,
      })
    } catch {
      void 0
    }
  }, [selectedNodeId])

  return (
    <FloatingPropsPanelMenuButton
      onClick={handleInvokeProbeTree}
      disabled={props.disabled}
      uiPanelKeyValueTextSizeClass={props.uiPanelKeyValueTextSizeClass}
      uiPanelTextFontClass={props.uiPanelTextFontClass}
    >
      {UI_COPY.propsPanelProbeTree}
    </FloatingPropsPanelMenuButton>
  )
}
