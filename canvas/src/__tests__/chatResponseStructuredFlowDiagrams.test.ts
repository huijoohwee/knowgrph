import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { appendChatHistoryWorkspaceFile } from '@/features/chat/chatHistoryWorkspace'
import { applyChatKgcWorkspaceDocumentToCanvas } from '@/features/chat/chatKgcCanvasApply'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_WIDGET_REGISTRY_METADATA_KEY,
} from '@/lib/config.flow-editor'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { collectStructuredFrontmatterFields } from '@/features/chat/chatResponseStructuredFrontmatter'
import type { JSONValue } from '@/lib/graph/types'

const readNodeById = (graphData: NonNullable<ReturnType<typeof useGraphStore.getState>['graphData']>, id: string) => (
  (graphData.nodes || []).find(node => String(node.id || '') === id) || null
)

export async function testChatResponseStructuredContentProjectsFlowDiagramsToDynamicRichMediaPanels() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  try {
    resetWorkspaceFsForTests()
    useGraphStore.getState().clearGraphData()
    globalThis.fetch = (async () => ({ ok: true } as Response)) as typeof fetch

    const assistantText = [
      '```yaml',
      'response:',
      '  structuredContent:',
      '    canvas:',
      '      renderer: "2D Renderer: Flow Editor"',
      '    flow_diagrams:',
      '      key: flow_diagrams',
      '      type: object',
      '      value:',
      '        gitgraph:',
      '          key: gitgraph',
      '          type: mermaid_gitgraph',
      '          title: Neutral Chat GitGraph',
      '          render_on: [flow_editor, storyboard]',
      '          value: |-',
      '            gitGraph',
      '              commit id:"intake"',
      '              branch parallel_lane',
      '              checkout parallel_lane',
      '              commit id:"panel_compute"',
      '              checkout main',
      '              merge parallel_lane',
      '        gantt:',
      '          key: gantt',
      '          type: mermaid_gantt',
      '          title: Neutral Chat Gantt',
      '          render_on: [flow_editor, timeline_view]',
      '          value: |-',
      '            gantt',
      '              title neutral chat diagram flow',
      '              dateFormat YYYY-MM-DD',
      '              section Intake',
      '              Intake :done, intake, 2026-06-05, 1d',
      '              section Critical path',
      '              Panel compute :crit, panel_compute, after intake, 1d',
      '    cards:',
      '      - id: diagram-source-card',
      '        label: Diagram Source Card',
      '        kind: text',
      '        output: "Structured response carries diagram frontmatter as data."',
      '```',
    ].join('\n')

    const workspacePath = await appendChatHistoryWorkspaceFile({
      requestedPath: '/chat-log/20260605T071000Z/kgc_20260605T071000Z.md',
      timestampMs: Date.UTC(2026, 5, 5, 7, 10, 0),
      providerSummary: 'structured flow diagrams test',
      userText: 'Render GitGraph and Gantt from neutral structured frontmatter.',
      assistantText,
      storageType: 'chatKnowgrph',
      traceId: 'trace-structured-flow-diagrams',
      title: 'Structured Flow Diagrams',
    })

    const fs = await getWorkspaceFs()
    const canonicalText = await fs.readFileText(workspacePath)
    for (const snippet of [
      'flow_diagrams:',
      'type: mermaid_gitgraph',
      'type: mermaid_gantt',
      'Neutral Chat GitGraph',
      'Neutral Chat Gantt',
    ]) {
      if (!canonicalText.includes(snippet)) throw new Error(`Expected canonical KGC file to include ${snippet}`)
    }
    if (/flow_diagrams:\s*["']\{/.test(canonicalText)) {
      throw new Error('Expected flow_diagrams to be projected as a YAML object, not a quoted JSON scalar')
    }

    const applied = await applyChatKgcWorkspaceDocumentToCanvas(workspacePath)
    if (!applied) throw new Error('Expected structured flow diagrams response to apply to canvas graph')
    const graphData = useGraphStore.getState().graphData
    if (!graphData || graphData.context !== 'frontmatter-flow') {
      throw new Error(`Expected active canvas graph to be frontmatter-flow, got: ${JSON.stringify(graphData?.metadata || null)}`)
    }
    const frontmatterMeta = (graphData.metadata || {}).frontmatterMeta as Record<string, unknown> | undefined
    if (!frontmatterMeta?.flow_diagrams) throw new Error('Expected source frontmatterMeta to preserve flow_diagrams')

    const expectedNodes = [
      ['flow-diagram-gitgraph-source', 'FlowDiagramSource'],
      ['flow-diagram-gitgraph-compute', FLOW_TEXT_GENERATION_NODE_TYPE_ID],
      ['flow-diagram-gitgraph-panel', FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID],
      ['flow-diagram-gantt-source', 'FlowDiagramSource'],
      ['flow-diagram-gantt-compute', FLOW_TEXT_GENERATION_NODE_TYPE_ID],
      ['flow-diagram-gantt-panel', FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID],
    ] as const
    for (const [id, type] of expectedNodes) {
      const node = readNodeById(graphData, id)
      if (!node) throw new Error(`Expected derived diagram node ${id}`)
      if (String(node.type || '') !== type) throw new Error(`Expected ${id} type ${type}, got ${String(node.type || '')}`)
    }

    const registry = Array.isArray(graphData.metadata?.[FLOW_WIDGET_REGISTRY_METADATA_KEY])
      ? graphData.metadata[FLOW_WIDGET_REGISTRY_METADATA_KEY] as never[]
      : []
    const connected = computeFlowConnectedValuesBySchemaPath({
      graphData,
      registry,
      targetNodeIds: new Set(['flow-diagram-gitgraph-panel', 'flow-diagram-gantt-panel']),
    })
    const gitgraphSrcDoc = connected.get('flow-diagram-gitgraph-panel')?.['properties.outputSrcDoc']
    const ganttSrcDoc = connected.get('flow-diagram-gantt-panel')?.['properties.outputSrcDoc']
    if (
      typeof gitgraphSrcDoc?.value !== 'string'
      || !gitgraphSrcDoc.value.includes('data-kg-flow-diagram-kind="gitgraph"')
      || !gitgraphSrcDoc.value.includes("data-kg-flow-diagram-chart='1'")
      || !gitgraphSrcDoc.value.includes('data-kg-mermaid-source="1"')
      || !gitgraphSrcDoc.value.includes('First-class terms')
      || !gitgraphSrcDoc.value.includes('parallel_lane')
      || !gitgraphSrcDoc.sources.some(source => source.nodeId === 'flow-diagram-gitgraph-compute' && source.portKey === 'outputSrcDoc')
    ) throw new Error(`Expected computed GitGraph Rich Media output, got: ${JSON.stringify(gitgraphSrcDoc)}`)
    if (
      typeof ganttSrcDoc?.value !== 'string'
      || !ganttSrcDoc.value.includes('data-kg-flow-diagram-kind="gantt"')
      || !ganttSrcDoc.value.includes("data-kg-flow-diagram-chart='1'")
      || !ganttSrcDoc.value.includes('data-kg-mermaid-source="1"')
      || !ganttSrcDoc.value.includes('Critical path')
      || !ganttSrcDoc.value.includes('Panel compute')
      || !ganttSrcDoc.sources.some(source => source.nodeId === 'flow-diagram-gantt-compute' && source.portKey === 'outputSrcDoc')
    ) throw new Error(`Expected computed Gantt Rich Media output, got: ${JSON.stringify(ganttSrcDoc)}`)

    const editedGraphData = {
      ...graphData,
      nodes: graphData.nodes.map(node => String(node.id || '') === 'flow-diagram-gitgraph-source'
        ? {
            ...node,
            properties: {
              ...(node.properties || {}),
              diagramSource: [
                'gitGraph',
                '  commit id:"intake"',
                '  branch revised_lane',
                '  checkout revised_lane',
                '  commit id:"revised_panel_compute"',
                '  checkout main',
                '  merge revised_lane',
              ].join('\n'),
            },
          }
        : node),
    }
    const recomputed = computeFlowConnectedValuesBySchemaPath({
      graphData: editedGraphData,
      registry,
      targetNodeIds: new Set(['flow-diagram-gitgraph-panel']),
    }).get('flow-diagram-gitgraph-panel')?.['properties.outputSrcDoc']?.value
    if (typeof recomputed !== 'string' || !recomputed.includes('revised_lane') || !recomputed.includes('revised_panel_compute')) {
      throw new Error(`Expected GitGraph Rich Media output to recompute from edited source, got: ${String(recomputed)}`)
    }
  } finally {
    useGraphStore.getState().clearGraphData()
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}

export function testChatResponseStructuredContentFlowDiagramsRejectsAliasRemap() {
  const canonical: Record<string, JSONValue> = {}
  collectStructuredFrontmatterFields({
    flow_diagrams: {
      key: 'flow_diagrams',
      type: 'object',
      value: {
        work: {
          key: 'work',
          type: 'mermaid_gantt',
          value: 'gantt\n  title canonical',
        },
      },
    },
  }, canonical)
  if (!canonical.flow_diagrams) throw new Error('Expected canonical flow_diagrams to project into structured frontmatter')

  for (const aliasKey of ['diagrams', 'flowdiagrams']) {
    const out: Record<string, JSONValue> = {}
    collectStructuredFrontmatterFields({
      [aliasKey]: {
        key: 'flow_diagrams',
        type: 'object',
        value: {
          work: {
            key: 'work',
            type: 'mermaid_gantt',
            value: 'gantt\n  title alias',
          },
        },
      },
    }, out)
    if (out.flow_diagrams) {
      throw new Error(`Expected ${aliasKey} to stay unprojected instead of remapping to flow_diagrams`)
    }
  }
}
