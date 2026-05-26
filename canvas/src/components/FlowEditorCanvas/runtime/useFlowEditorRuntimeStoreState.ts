import { useShallow } from 'zustand/react/shallow'

import { EMPTY_WIDGET_REGISTRY } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_BOOL_RECORD: Record<string, boolean> = {}

export function useFlowEditorRuntimeStoreState() {
  return useGraphStore(
    useShallow(s => ({
      baseGraphData: s.graphData,
      baseGraphDataRevision: s.graphDataRevision || 0,
      graphContentRevision: s.graphContentRevision || 0,
      resolvedThemeMode: (s.resolvedThemeMode || 'light') as 'light' | 'dark',
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      documentSemanticMode: s.documentSemanticMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      collapsedGroupIds: s.collapsedGroupIds,
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentSourceUrl: s.markdownDocumentSourceUrl,
      markdownDocumentApplyViewPreset: s.markdownDocumentApplyViewPreset,
      selectedNodeId: typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null,
      selectedNodeIds: Array.isArray(s.selectedNodeIds) ? s.selectedNodeIds : EMPTY_STRING_ARRAY,
      selectedEdgeId: typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null,
      flowWidgetPinnedByNodeId: resolveScopedFlowWidgetNodeMap({
        graphMetaKey: buildGraphMetaKeyIgnoringPending(s.graphData),
        keyedByGraphMetaKey: (s as unknown as { flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, Record<string, boolean>> }).flowWidgetPinnedByNodeIdByGraphMetaKey,
        globalByNodeId: s.flowWidgetPinnedByNodeId,
      }) ?? EMPTY_BOOL_RECORD,
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
        (s.openWidgetNodeIdsByRenderer?.flowEditor && Array.isArray(s.openWidgetNodeIdsByRenderer.flowEditor)
          ? s.openWidgetNodeIdsByRenderer.flowEditor
          : s.openWidgetNodeIds) ?? EMPTY_STRING_ARRAY,
      updateOpenWidgetNodeIds: s.updateOpenWidgetNodeIds,
      setOpenWidgetNodeIds: s.setOpenWidgetNodeIds,
    })),
  )
}
