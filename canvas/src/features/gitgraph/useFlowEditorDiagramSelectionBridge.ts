import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { MermaidDiagramCodeModel, MermaidStructuredDiagramKind } from '@/lib/mermaid/mermaidDiagramCode'
import { buildFlowEditorPortRows } from '@/lib/flowEditor/flowEditorPortRows'
import {
  buildFlowEditorDiagramSelectionBridge,
  resolveDiagramRowKeyForFlowEditorPortRow,
  resolveFlowEditorPortRowKeyForDiagramRow,
} from '@/lib/flowEditor/flowEditorDiagramSelection'

export function useFlowEditorDiagramSelectionBridge({
  graphData,
  diagramModel,
  kind,
}: {
  graphData: Pick<GraphData, 'nodes' | 'edges'> | null | undefined
  diagramModel: Pick<MermaidDiagramCodeModel, 'rows'>
  kind: MermaidStructuredDiagramKind
}) {
  const portRows = React.useMemo(() => buildFlowEditorPortRows(graphData).rows, [graphData])
  const bridge = React.useMemo(() => buildFlowEditorDiagramSelectionBridge({
    diagramRows: diagramModel.rows,
    flowRows: portRows,
  }), [diagramModel.rows, portRows])
  const {
    flowEditorSelectedPortRowKey,
    selectedNodeId,
    selectedDiagramRowKey,
    selectNode,
    setSelectionSource,
    setFlowEditorSelectedPortRowKey,
    setMermaidDiagramSelectedRowKey,
  } = useGraphStore(
    useShallow(state => ({
      flowEditorSelectedPortRowKey: state.flowEditorSelectedPortRowKey || '',
      selectedNodeId: state.selectedNodeId || '',
      selectedDiagramRowKey: state.mermaidDiagramSelectedRowKeyByKind[kind] || '',
      selectNode: state.selectNode,
      setSelectionSource: state.setSelectionSource,
      setFlowEditorSelectedPortRowKey: state.setFlowEditorSelectedPortRowKey,
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )

  const handleDiagramSelectedRowKeyChange = React.useCallback((rowKey: string | null) => {
    const nextRowKey = String(rowKey || '').trim()
    if (!nextRowKey) {
      if (!flowEditorSelectedPortRowKey) return
      setFlowEditorSelectedPortRowKey(null)
      return
    }
    const nextPortRowKey = resolveFlowEditorPortRowKeyForDiagramRow(bridge, nextRowKey)
    if ((nextPortRowKey || '') !== flowEditorSelectedPortRowKey) {
      setFlowEditorSelectedPortRowKey(nextPortRowKey || null)
    }
    const nextPortRow = nextPortRowKey ? portRows.find(row => row.key === nextPortRowKey) || null : null
    const nextNodeId = String(nextPortRow?.nodeId || '').trim()
    if (!nextNodeId || nextNodeId === selectedNodeId) return
    setSelectionSource('editor')
    selectNode(nextNodeId)
  }, [
    bridge,
    flowEditorSelectedPortRowKey,
    portRows,
    selectNode,
    selectedNodeId,
    setFlowEditorSelectedPortRowKey,
    setSelectionSource,
  ])

  React.useEffect(() => {
    if (!flowEditorSelectedPortRowKey) {
      if (selectedDiagramRowKey) setMermaidDiagramSelectedRowKey(kind, null)
      return
    }
    if (resolveFlowEditorPortRowKeyForDiagramRow(bridge, selectedDiagramRowKey) === flowEditorSelectedPortRowKey) return
    const nextDiagramRowKey = resolveDiagramRowKeyForFlowEditorPortRow(bridge, flowEditorSelectedPortRowKey)
    if (!nextDiagramRowKey || nextDiagramRowKey === selectedDiagramRowKey) return
    setMermaidDiagramSelectedRowKey(kind, nextDiagramRowKey)
  }, [bridge, flowEditorSelectedPortRowKey, kind, selectedDiagramRowKey, setMermaidDiagramSelectedRowKey])

  return {
    handleDiagramSelectedRowKeyChange,
  }
}
