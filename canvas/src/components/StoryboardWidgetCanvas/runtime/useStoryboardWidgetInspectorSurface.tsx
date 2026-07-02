import React from 'react'

import StoryboardWidgetInspector, { type InspectorTab } from '@/components/StoryboardWidget/StoryboardWidgetInspector'
import { readSubgraphs, subgraphGroupId } from '@/lib/graph/subgraphs'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { UI_COPY } from '@/lib/config'

export function useStoryboardWidgetInspectorSurface(args: {
  active: boolean
  baseGraphData: GraphData | null
  draftGraphData: GraphData | null
  selectedDraftNode: GraphNode | null
  selectedDraftEdge: GraphEdge | null
  selectedNodeId: string | null
  selectedNodeIds: string[]
  collapsedGroupIds: string[]
  inspectorTab: InspectorTab
  setInspectorTab: React.Dispatch<React.SetStateAction<InspectorTab>>
  createUserSubgraph: (args: { label?: string; kind?: 'subgraph' | 'cluster'; memberNodeIds: string[] }) => { ok: boolean; id?: string; message?: string }
  updateUserSubgraph: (id: string, patch: { label?: string; kind?: 'subgraph' | 'cluster'; parentId?: string | null }) => { ok: boolean; message?: string }
  removeUserSubgraph: (id: string) => void
  addNodesToUserSubgraph: (id: string, nodeIds: string[]) => { ok: boolean; message?: string }
  removeNodesFromUserSubgraph: (id: string, nodeIds: string[]) => { ok: boolean; message?: string }
  toggleGroupCollapsed: (id: string) => void
  setSelectionSource: (source: 'canvas' | 'menu' | 'toolbar' | 'editor' | 'unknown') => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  selectGroup: (id: string | null) => void
  runWorkflowNode: (id: string) => Promise<void> | void
  exportWorkflowBundle: () => Promise<void> | void
  jsonError: string | null
  nodePropsJson: string
  setNodePropsJson: React.Dispatch<React.SetStateAction<string>>
  nodeMetaJson: string
  setNodeMetaJson: React.Dispatch<React.SetStateAction<string>>
  edgePropsJson: string
  setEdgePropsJson: React.Dispatch<React.SetStateAction<string>>
  edgeMetaJson: string
  setEdgeMetaJson: React.Dispatch<React.SetStateAction<string>>
  workflowMetaJson: string
  setWorkflowMetaJson: React.Dispatch<React.SetStateAction<string>>
  workflowContextJson: string
  setWorkflowContextJson: React.Dispatch<React.SetStateAction<string>>
  setSelectedNodeLabel: (label: string) => void
  patchSelectedNodeProperties: (patch: Record<string, unknown>) => void
  setSelectedNodeType: (type: string) => void
  setSelectedEdgeLabel: (label: string) => void
  applyJsonToDraft: (args: { target: 'nodeProps' | 'nodeMeta' | 'edgeProps' | 'edgeMeta' | 'workflowMeta' | 'workflowContext' }) => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
}) {
  const subgraphs = React.useMemo(() => readSubgraphs(args.baseGraphData), [args.baseGraphData])

  const createSubgraphFromSelection = React.useCallback((nextArgs: { label?: string; kind?: 'subgraph' | 'cluster' }) => {
    const nodeIds = (args.selectedNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
    const res = args.createUserSubgraph({ label: nextArgs?.label, kind: nextArgs?.kind, memberNodeIds: nodeIds })
    if (res.ok === false) {
      args.upsertUiToast({ id: 'storyboard-widget-subgraph-create-failed', kind: 'warning', message: res.message, ttlMs: 2500 })
      return
    }
    const gid = subgraphGroupId(res.id)
    if (!gid) return
    args.setSelectionSource('canvas')
    args.selectNode(null)
    args.selectEdge(null)
    args.selectGroup(gid)
    args.setInspectorTab('groups')
  }, [args])

  const wrapSubgraphMutation = React.useCallback((toastId: string, messagePrefix: string, fn: () => { ok: boolean; message?: string }) => {
    const res = fn()
    if (res.ok === false) args.upsertUiToast({ id: toastId, kind: 'warning', message: res.message || messagePrefix, ttlMs: 2500 })
  }, [args])

  const inspectorElement = (
    <StoryboardWidgetInspector
      active={args.active}
      tab={args.inspectorTab}
      setTab={args.setInspectorTab}
      selectedNode={args.selectedDraftNode}
      selectedEdge={args.selectedDraftEdge}
      subgraphs={subgraphs}
      selectedNodeIds={args.selectedNodeIds}
      collapsedGroupIds={args.collapsedGroupIds}
      onCreateSubgraphFromSelection={createSubgraphFromSelection}
      onSetSubgraphKind={(id, kind) => wrapSubgraphMutation(`storyboard-widget-subgraph-kind-failed-${String(id || '')}`, UI_COPY.storyboardWidgetRunFailedToast, () => args.updateUserSubgraph(id, { kind }))}
      onRenameSubgraph={(id, label) => wrapSubgraphMutation(`storyboard-widget-subgraph-rename-failed-${String(id || '')}`, UI_COPY.storyboardWidgetRunFailedToast, () => args.updateUserSubgraph(id, { label }))}
      onDeleteSubgraph={args.removeUserSubgraph}
      onSetSubgraphParent={(id, parentId) => wrapSubgraphMutation(`storyboard-widget-subgraph-parent-failed-${String(id || '')}`, UI_COPY.storyboardWidgetRunFailedToast, () => args.updateUserSubgraph(id, { parentId }))}
      onAddSelectionToSubgraph={(id) => {
        const nodeIds = (args.selectedNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
        wrapSubgraphMutation(`storyboard-widget-subgraph-add-failed-${String(id || '')}`, UI_COPY.storyboardWidgetRunFailedToast, () => args.addNodesToUserSubgraph(id, nodeIds))
      }}
      onRemoveSelectionFromSubgraph={(id) => {
        const nodeIds = (args.selectedNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
        wrapSubgraphMutation(`storyboard-widget-subgraph-remove-failed-${String(id || '')}`, UI_COPY.storyboardWidgetRunFailedToast, () => args.removeNodesFromUserSubgraph(id, nodeIds))
      }}
      onToggleSubgraphCollapsed={(id) => {
        const gid = subgraphGroupId(id)
        if (gid) args.toggleGroupCollapsed(gid)
      }}
      onSelectSubgraph={(id) => {
        const gid = subgraphGroupId(id)
        if (!gid) return
        args.setSelectionSource('canvas')
        args.selectNode(null)
        args.selectEdge(null)
        args.selectGroup(gid)
      }}
      workflowNodes={args.draftGraphData?.nodes || []}
      workflowSelectedNodeId={args.selectedNodeId}
      onWorkflowSelectNode={(id) => {
        args.setInspectorTab('node')
        args.setSelectionSource('canvas')
        args.selectEdge(null)
        args.selectNode(id)
      }}
      onWorkflowRunNode={args.runWorkflowNode}
      onWorkflowExportBundle={args.exportWorkflowBundle}
      jsonError={args.jsonError}
      nodePropsJson={args.nodePropsJson}
      setNodePropsJson={args.setNodePropsJson}
      nodeMetaJson={args.nodeMetaJson}
      setNodeMetaJson={args.setNodeMetaJson}
      edgePropsJson={args.edgePropsJson}
      setEdgePropsJson={args.setEdgePropsJson}
      edgeMetaJson={args.edgeMetaJson}
      setEdgeMetaJson={args.setEdgeMetaJson}
      workflowMetaJson={args.workflowMetaJson}
      setWorkflowMetaJson={args.setWorkflowMetaJson}
      workflowContextJson={args.workflowContextJson}
      setWorkflowContextJson={args.setWorkflowContextJson}
      onSetNodeLabel={args.setSelectedNodeLabel}
      onPatchSelectedNodeProperties={args.patchSelectedNodeProperties}
      onSetNodeType={args.setSelectedNodeType}
      onSetEdgeLabel={args.setSelectedEdgeLabel}
      onApplyJson={(target) => args.applyJsonToDraft({ target })}
    />
  )

  return { inspectorElement, subgraphs }
}
