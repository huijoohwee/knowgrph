import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type SelectorFallbackCheck = {
  path: string
  forbiddenSnippets: string[]
}

const CHECKS: SelectorFallbackCheck[] = [
  {
    path: 'src/components/FlowCanvas/useFlowCanvasStoreState.ts',
    forbiddenSnippets: [
      'collapsedGroupIds: s.collapsedGroupIds || []',
      'openWidgetNodeIds: s.openWidgetNodeIds || []',
      'flowWidgetPinnedByNodeId: s.flowWidgetPinnedByNodeId || {}',
    ],
  },
  {
    path: 'src/components/FlowEditorCanvas.runtime.tsx',
    forbiddenSnippets: [
      'Array.isArray(s.selectedNodeIds) ? s.selectedNodeIds : []',
      's.flowWidgetPinnedByNodeId || {}',
      's.openWidgetNodeIds || []',
    ],
  },
  {
    path: 'src/components/FlowEditorCanvas/runtime/useFlowEditorRuntimeStoreState.ts',
    forbiddenSnippets: [
      'flowWidgetPinnedByNodeId: stripFrontmatterAutoManagedWidgetPinnedStates({',
    ],
  },
  {
    path: 'src/components/CanvasViewport.tsx',
    forbiddenSnippets: [
      'openWidgetNodeIds: s.openWidgetNodeIds || []',
      'openWidgetNodeIdsByRenderer: s.openWidgetNodeIdsByRenderer || {}',
    ],
  },
  {
    path: 'src/components/FlowEditor/NodeOverlayEditorInner.tsx',
    forbiddenSnippets: [
      'openWidgetNodeIds: s.openWidgetNodeIds || []',
    ],
  },
  {
    path: 'src/features/graph-table/ui/GraphTableInspector.tsx',
    forbiddenSnippets: [
      'widgetRegistry: s.widgetRegistry || []',
      'openWidgetNodeIds: s.openWidgetNodeIds || []',
    ],
  },
  {
    path: 'src/lib/markdown-workspace-runtime/MarkdownWorkspaceRuntime.impl.tsx',
    forbiddenSnippets: [
      'const openWidgetNodeIds = useGraphStore(s => s.openWidgetNodeIds || [])',
    ],
  },
  {
    path: 'src/components/RichMediaPanel.tsx',
    forbiddenSnippets: [
      'const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])',
    ],
  },
  {
    path: 'src/features/toolbar/GrabMapsDiscoveryWidgetSection.tsx',
    forbiddenSnippets: [
      'const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])',
    ],
  },
  {
    path: 'src/features/spotlight/LaunchSpotlightStatusCard.tsx',
    forbiddenSnippets: [
      'const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])',
      'const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds || [])',
      'const selectedGroupIds = useGraphStore(s => s.selectedGroupIds || [])',
    ],
  },
  {
    path: 'src/features/graph-table/ui/GraphTableSelectionInspector.tsx',
    forbiddenSnippets: [
      'const openWidgetNodeIds = useGraphStore(s => s.openWidgetNodeIds || [])',
      'const collapsedGroupIds = useGraphStore(s => (s.collapsedGroupIds || []) as string[])',
    ],
  },
  {
    path: 'src/features/graph-stats/hooks/useStatsDerivedData.ts',
    forbiddenSnippets: [
      'const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])',
    ],
  },
  {
    path: 'src/features/graph-stats/hooks/useStatsSelection.ts',
    forbiddenSnippets: [
      'const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])',
      'const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds || [])',
    ],
  },
  {
    path: 'src/features/panels/views/DatasetInspectorSection.tsx',
    forbiddenSnippets: [
      'const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])',
      'const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds || [])',
    ],
  },
  {
    path: 'src/lib/panels/views/PreviewPanelView.impl.tsx',
    forbiddenSnippets: [
      'const widgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry || [])',
      'const baseWidgetRegistry = useGraphStore(s => s.widgetRegistry || [])',
      'const documentWidgetRegistry = useGraphStore(s => s.documentWidgetRegistry || [])',
    ],
  },
  {
    path: 'src/components/GraphCanvasRoot/GraphCanvasRootImpl.tsx',
    forbiddenSnippets: [
      'collapsedGroupIds: s.collapsedGroupIds || []',
    ],
  },
  {
    path: 'src/hooks/active-graph-data/useActiveGraphRenderData.impl.ts',
    forbiddenSnippets: [
      'collapsedGroupIds: (s.collapsedGroupIds || []) as string[]',
    ],
  },
]

export function testUseGraphStoreSelectorsAvoidFreshEmptyFallbacksInHotPaths() {
  for (const check of CHECKS) {
    const filePath = resolve(process.cwd(), check.path)
    const text = readFileSync(filePath, 'utf8')
    for (const forbidden of check.forbiddenSnippets) {
      if (text.includes(forbidden)) {
        throw new Error(`expected ${check.path} to avoid unstable selector fallback: ${forbidden}`)
      }
    }
  }
}
