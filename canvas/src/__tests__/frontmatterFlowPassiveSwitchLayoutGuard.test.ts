import { useGraphStore } from '@/hooks/useGraphStore'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'

export function testFrontmatterFlowImportModeKeepsWidgetPlacementCachesForPassiveSwitches() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvasRenderMode('2d')
  useGraphStore.getState().setCanvas2dRenderer('d3')
  const graph = {
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow' },
    nodes: [{ id: 'w1', type: 'TextGeneration', label: 'w1', properties: { 'flow:widgetFormId': 'textGeneration.openai' } }],
    edges: [],
  } as const
  const graphKey = buildGraphMetaKeyIgnoringPending(graph as never) || 'frontmatter-flow:demo'
  useGraphStore.setState({
    workspaceViewMode: 'editor',
    workspaceCanvasPaneOpen: true,
    markdownWorkspaceIndexingInFlight: false,
    workspaceGraphMutationBlockUntilMs: Date.now() + 1000,
    flowWidgetPinnedByNodeId: { w1: false },
    flowWidgetPinnedByNodeIdByGraphMetaKey: { [graphKey]: { w1: false } },
    flowWidgetPosByNodeId: { w1: { left: 2400, top: 700 } },
    flowWidgetPosByNodeIdByGraphMetaKey: { [graphKey]: { w1: { left: 2400, top: 700 } } },
    flowWidgetWorldPosByNodeId: { w1: { x: 2400, y: 700 } },
    flowWidgetWorldPosByNodeIdByGraphMetaKey: { [graphKey]: { w1: { x: 2400, y: 700 } } },
  } as never)

  applyFrontmatterFlowImportModes(graph as never, {
    applyViewPreset: false,
    resetWidgetLayout: false,
  })

  const st = useGraphStore.getState()
  if (st.flowWidgetPosByNodeId.w1?.left !== 2400 || st.flowWidgetWorldPosByNodeId.w1?.x !== 2400) {
    throw new Error('expected passive frontmatter-flow Source Files switch not to clear widget placement caches')
  }
  if (st.canvas2dRenderer === 'storyboard') {
    throw new Error('expected passive frontmatter-flow Source Files switch not to force Storyboard renderer from YAML/frontmatter')
  }
}
