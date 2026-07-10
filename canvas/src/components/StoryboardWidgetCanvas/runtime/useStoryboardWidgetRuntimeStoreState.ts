import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { EMPTY_WIDGET_REGISTRY } from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import { useActiveGraphData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/storyboardWidget/widgetStateScope'
import { buildGraphDocumentMetaKey } from '@/lib/graph/graphMetaKey'

const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_BOOL_RECORD: Record<string, boolean> = {}

export function useStoryboardWidgetRuntimeStoreState() {
  const activeBaseGraphData = useActiveGraphData(true)
  const state = useGraphStore(
    useShallow(s => ({
      rawBaseGraphData: s.graphData,
      baseGraphDataRevision: s.graphDataRevision || 0,
      graphContentRevision: s.graphContentRevision || 0,
      resolvedThemeMode: (s.resolvedThemeMode || 'light') as 'light' | 'dark',
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      canvasRunMode: s.canvasRunMode,
      documentSemanticMode: s.documentSemanticMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      storyboardWidgetLayoutRebalanceRequest: s.storyboardWidgetLayoutRebalanceRequest,
      collapsedGroupIds: s.collapsedGroupIds,
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentText: s.markdownDocumentText,
      markdownDocumentSourceUrl: s.markdownDocumentSourceUrl,
      markdownDocumentApplyViewPreset: s.markdownDocumentApplyViewPreset,
      markdownDocumentApplyRevision: s.markdownDocumentApplyRevision || 0,
      selectedNodeId: typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null,
      selectedNodeIds: Array.isArray(s.selectedNodeIds) ? s.selectedNodeIds : EMPTY_STRING_ARRAY,
      selectedEdgeId: typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null,
      flowWidgetPinnedByNodeIdByGraphMetaKey: (s as unknown as { flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, Record<string, boolean>> }).flowWidgetPinnedByNodeIdByGraphMetaKey,
      globalFlowWidgetPinnedByNodeId: s.flowWidgetPinnedByNodeId,
      setSelectionSource: s.setSelectionSource,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      selectGroup: s.selectGroup,
      setGraphDataPreservingLayout: s.setGraphDataPreservingLayout,
      addNode: s.addNode,
      updateNode: s.updateNode,
      updateEdge: s.updateEdge,
      addEdge: s.addEdge,
      createUserSubgraph: s.createUserSubgraph,
      updateUserSubgraph: s.updateUserSubgraph,
      removeUserSubgraph: s.removeUserSubgraph,
      addNodesToUserSubgraph: s.addNodesToUserSubgraph,
      removeNodesFromUserSubgraph: s.removeNodesFromUserSubgraph,
      upsertUiToast: s.upsertUiToast,
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      schema: s.schema,
      setSchema: s.setSchema,
      toggleGroupCollapsed: s.toggleGroupCollapsed,
      workspaceMutationBlocked: isWorkspaceGraphMutationBlocked(s),
      documentWidgetRegistry: Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : EMPTY_WIDGET_REGISTRY,
      effectiveWidgetRegistry: Array.isArray(s.effectiveWidgetRegistry) ? s.effectiveWidgetRegistry : EMPTY_WIDGET_REGISTRY,
      baseWidgetRegistry: Array.isArray(s.widgetRegistry) ? s.widgetRegistry : EMPTY_WIDGET_REGISTRY,
      openWidgetNodeIds:
        (Array.isArray(s.openWidgetNodeIdsByRenderer?.[s.canvas2dRenderer])
          ? s.openWidgetNodeIdsByRenderer[s.canvas2dRenderer]
          : s.openWidgetNodeIds) ?? EMPTY_STRING_ARRAY,
      updateOpenWidgetNodeIds: s.updateOpenWidgetNodeIds,
      setOpenWidgetNodeIds: s.setOpenWidgetNodeIds,
    })),
  )
  const baseGraphData = activeBaseGraphData || state.rawBaseGraphData
  const flowWidgetPinnedByNodeId = React.useMemo(
    () =>
      resolveScopedFlowWidgetNodeMap({
        graphMetaKey: buildGraphDocumentMetaKey(baseGraphData),
        keyedByGraphMetaKey: state.flowWidgetPinnedByNodeIdByGraphMetaKey,
        globalByNodeId: state.globalFlowWidgetPinnedByNodeId,
      }) ?? EMPTY_BOOL_RECORD,
    [baseGraphData, state.flowWidgetPinnedByNodeIdByGraphMetaKey, state.globalFlowWidgetPinnedByNodeId],
  )
  return React.useMemo(() => {
    const {
      rawBaseGraphData: _rawBaseGraphData,
      flowWidgetPinnedByNodeIdByGraphMetaKey: _flowWidgetPinnedByNodeIdByGraphMetaKey,
      globalFlowWidgetPinnedByNodeId: _globalFlowWidgetPinnedByNodeId,
      ...rest
    } = state
    void _rawBaseGraphData
    void _flowWidgetPinnedByNodeIdByGraphMetaKey
    void _globalFlowWidgetPinnedByNodeId
    return { ...rest, baseGraphData, flowWidgetPinnedByNodeId }
  }, [baseGraphData, flowWidgetPinnedByNodeId, state])
}
