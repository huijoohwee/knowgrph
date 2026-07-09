import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { MermaidDiagramCodeModel, MermaidStructuredDiagramKind } from '@/lib/mermaid/mermaidDiagramCode'
import { dispatchRuntimeZoomActionSoon } from '@/lib/canvas/runtimeZoomDispatch'
import { findMermaidDiagramRowForRowKey } from '@/lib/mermaid/mermaidDiagramSelection'
import { buildStoryboardWidgetPortRows } from '@/lib/storyboardWidget/storyboardWidgetPortRows'
import {
  buildStoryboardWidgetDiagramSelectionBridge,
  resolveDiagramRowKeyForStoryboardWidgetPortRow,
  resolveStoryboardWidgetPortRowKeyForDiagramRow,
} from '@/lib/storyboardWidget/storyboardWidgetDiagramSelection'
import { resolveGraphNodeIdForGanttDiagramRow } from './ganttGraphNodeSelection'

export function useStoryboardWidgetDiagramSelectionBridge({
  graphData,
  diagramModel,
  kind,
}: {
  graphData: Pick<GraphData, 'nodes' | 'edges'> | null | undefined
  diagramModel: Pick<MermaidDiagramCodeModel, 'rows'>
  kind: MermaidStructuredDiagramKind
}) {
  const portRows = React.useMemo(() => buildStoryboardWidgetPortRows(graphData).rows, [graphData])
  const bridge = React.useMemo(() => buildStoryboardWidgetDiagramSelectionBridge({
    diagramRows: diagramModel.rows,
    flowRows: portRows,
  }), [diagramModel.rows, portRows])
  const diagramSelectionWriteRef = React.useRef(false)
  const {
    storyboardWidgetSelectedPortRowKey,
    selectedNodeId,
    selectedDiagramRowKey,
    selectNode,
    setSelectionSource,
    setStoryboardWidgetSelectedPortRowKey,
    setMermaidDiagramSelectedRowKey,
  } = useGraphStore(
    useShallow(state => ({
      storyboardWidgetSelectedPortRowKey: state.storyboardWidgetSelectedPortRowKey || '',
      selectedNodeId: state.selectedNodeId || '',
      selectedDiagramRowKey: state.mermaidDiagramSelectedRowKeyByKind[kind] || '',
      selectNode: state.selectNode,
      setSelectionSource: state.setSelectionSource,
      setStoryboardWidgetSelectedPortRowKey: state.setStoryboardWidgetSelectedPortRowKey,
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )

  const handleDiagramSelectedRowKeyChange = React.useCallback((rowKey: string | null) => {
    diagramSelectionWriteRef.current = true
    const nextRowKey = String(rowKey || '').trim()
    if (!nextRowKey) {
      if (!storyboardWidgetSelectedPortRowKey) return
      setStoryboardWidgetSelectedPortRowKey(null)
      return
    }
    const nextPortRowKey = resolveStoryboardWidgetPortRowKeyForDiagramRow(bridge, nextRowKey)
    if ((nextPortRowKey || '') !== storyboardWidgetSelectedPortRowKey) {
      setStoryboardWidgetSelectedPortRowKey(nextPortRowKey || null)
    }
    if (kind === 'gantt') {
      const directRow = findMermaidDiagramRowForRowKey(diagramModel.rows, nextRowKey)
      const directNodeId = resolveGraphNodeIdForGanttDiagramRow({ graphData, row: directRow })
      if (directNodeId) {
        setSelectionSource('editor')
        if (directNodeId !== selectedNodeId) selectNode(directNodeId)
        dispatchRuntimeZoomActionSoon('selection')
        return
      }
    }
    const nextPortRow = nextPortRowKey ? portRows.find(row => row.key === nextPortRowKey) || null : null
    const nextNodeId = String(nextPortRow?.nodeId || '').trim()
    if (!nextNodeId || nextNodeId === selectedNodeId) return
    setSelectionSource('editor')
    selectNode(nextNodeId)
    dispatchRuntimeZoomActionSoon('selection')
  }, [
    bridge,
    diagramModel.rows,
    graphData,
    kind,
    storyboardWidgetSelectedPortRowKey,
    portRows,
    selectNode,
    selectedNodeId,
    setStoryboardWidgetSelectedPortRowKey,
    setSelectionSource,
  ])

  React.useEffect(() => {
    if (!storyboardWidgetSelectedPortRowKey) {
      if (diagramSelectionWriteRef.current) {
        diagramSelectionWriteRef.current = false
        return
      }
      if (selectedDiagramRowKey) setMermaidDiagramSelectedRowKey(kind, null)
      return
    }
    diagramSelectionWriteRef.current = false
    if (resolveStoryboardWidgetPortRowKeyForDiagramRow(bridge, selectedDiagramRowKey) === storyboardWidgetSelectedPortRowKey) return
    const nextDiagramRowKey = resolveDiagramRowKeyForStoryboardWidgetPortRow(bridge, storyboardWidgetSelectedPortRowKey)
    if (!nextDiagramRowKey || nextDiagramRowKey === selectedDiagramRowKey) return
    setMermaidDiagramSelectedRowKey(kind, nextDiagramRowKey)
  }, [bridge, storyboardWidgetSelectedPortRowKey, kind, selectedDiagramRowKey, setMermaidDiagramSelectedRowKey])

  return {
    handleDiagramSelectedRowKeyChange,
  }
}
