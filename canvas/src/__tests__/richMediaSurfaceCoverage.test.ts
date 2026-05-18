import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ensureDefaultWidgetRegistryEntries } from '@/hooks/store/flowEditorManagerSlice'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import { FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import {
  computeRichMediaOverlayConnectedValuesByNodeId,
  listDisplayRichMediaOverlayNodes,
} from '@/lib/render/richMediaSsot'

function buildConnectedMarkdownRichMediaGraph(): {
  graphData: GraphData
  registry: ReturnType<typeof ensureDefaultWidgetRegistryEntries>['entries']
} {
  const registry = ensureDefaultWidgetRegistryEntries([], '2026-05-18T00:00:00.000Z').entries
  const markdown = [
    '| Kind | Value |',
    '| --- | --- |',
    '| Table | Multi-dimensional |',
    '',
    '![Image](https://example.com/generated.png)',
    '',
    '```ts',
    'const value = 42',
    '```',
    '',
    '> Quoted line',
  ].join('\n')
  return {
    registry,
    graphData: {
      type: 'GraphData',
      context: 'frontmatter-flow',
      nodes: [
        {
          id: 'source-text-widget',
          type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
          label: 'Text Widget',
          properties: {
            [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
            [FLOW_WIDGET_FORM_ID_KEY]: 'textGeneration.openai',
            output: markdown,
            'flow:portTypes': {
              in: {},
              out: { text_out: 'TEXT' },
            },
          },
        },
        {
          id: 'rich-media-panel',
          type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
          label: 'Rich Media Panel',
          properties: {
            [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
            [FLOW_WIDGET_FORM_ID_KEY]: 'richMediaPanel',
            richMediaActiveTab: 'text',
            'flow:portTypes': {
              in: {
                output: 'TEXT',
                imageUrl: 'IMAGE_URL',
                videoUrl: 'VIDEO_URL',
                outputSrcDoc: 'HTML',
              },
              out: {
                output: 'TEXT',
                imageUrl: 'IMAGE_URL',
                videoUrl: 'VIDEO_URL',
                outputSrcDoc: 'HTML',
              },
            },
          },
        },
      ],
      edges: [
        {
          id: 'edge-text-to-panel',
          source: 'source-text-widget',
          target: 'rich-media-panel',
          label: 'linksTo',
          properties: {
            'flow:sourcePortKey': 'text_out',
            'flow:targetPortKey': 'output',
          },
        },
      ],
      metadata: {},
    } as GraphData,
  }
}

export function testRichMediaPanelMarkdownPayloadCoversRendererModeMatrix() {
  const { graphData, registry } = buildConnectedMarkdownRichMediaGraph()
  const graphSemanticKey = buildScopedGraphSemanticKey('rich-media-surface-coverage', {
    graphData,
    graphRevision: 1,
  })
  const connectedValuesByNodeId = computeRichMediaOverlayConnectedValuesByNodeId({
    graphData,
    registry,
    graphRevision: 1,
    graphSemanticKey,
    includeMediaSpecNodes: true,
  })
  const nodes = graphData.nodes as GraphNode[]
  const nodeById = new Map(nodes.map(node => [String(node.id || '').trim(), node] as const))
  const cases = [
    ['2D:D3:block:document', { renderMediaAsNodes: true, canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['2D:Flowchart:radial:keyword', { renderMediaAsNodes: true, canvas2dRenderer: 'flowchart', frontmatterModeEnabled: false, documentSemanticMode: 'keyword' }],
    ['2D:FlowCanvas:block:document-structure', { renderMediaAsNodes: true, canvas2dRenderer: 'flow', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['2D:Design:block:multi-dimensional-table', { renderMediaAsNodes: true, canvas2dRenderer: 'design', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['2D:FlowEditor:frontmatter-forced-display', { renderMediaAsNodes: false, canvas2dRenderer: 'flowEditor', frontmatterModeEnabled: true, documentSemanticMode: 'document' }],
    ['Surface:3D:display-control', { renderMediaAsNodes: true, canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['Surface:XR:display-control', { renderMediaAsNodes: true, canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['Surface:Voxel:display-control', { renderMediaAsNodes: true, canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['Surface:Geospatial:display-control', { renderMediaAsNodes: true, canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
  ] as const

  for (const [label, args] of cases) {
    const overlays = listDisplayRichMediaOverlayNodes({
      ...args,
      nodes,
      poolMax: 24,
      connectedValuesByNodeId,
      nodeById,
    })
    const panel = overlays.find(node => node.id === 'rich-media-panel')
    if (!panel) throw new Error(`expected ${label} to include the connected Rich Media Panel overlay`)
    if (panel.kind !== 'iframe') throw new Error(`expected ${label} text/table payload to render as iframe, got ${panel.kind}`)
    const srcDoc = String(panel.srcDoc || '')
    for (const snippet of ['data-kg-rich-media-markdown-srcdoc="1"', '<table>', '<blockquote>', '<pre><code', 'const value = 42']) {
      if (!srcDoc.includes(snippet)) throw new Error(`expected ${label} srcDoc snippet: ${snippet}`)
    }
  }
}

export function testRichMediaSurfaceRuntimePathsReuseSharedOverlayOwners() {
  const root = process.cwd()
  const ssot = readFileSync(resolve(root, 'src', 'lib', 'render', 'richMediaSsot.ts'), 'utf8')
  const d3Hook = readFileSync(resolve(root, 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts'), 'utf8')
  const flowCanvas = readFileSync(resolve(root, 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts'), 'utf8')
  const three = readFileSync(resolve(root, 'src', 'lib', 'three', 'useThreeRichMediaOverlayController.tsx'), 'utf8')
  const design = readFileSync(resolve(root, 'src', 'components', 'DesignCanvas', 'MediaOverlay.tsx'), 'utf8')

  if (!ssot.includes('export function computeRichMediaOverlayConnectedValuesByNodeId')) {
    throw new Error('expected connected Rich Media overlay value derivation to live in the Rich Media SSOT')
  }
  for (const [label, text] of [['D3', d3Hook], ['FlowCanvas', flowCanvas], ['3D', three]] as const) {
    if (!text.includes('computeRichMediaOverlayConnectedValuesByNodeId({')) {
      throw new Error(`expected ${label} runtime to reuse the shared connected Rich Media overlay helper`)
    }
    if (text.includes('computeFlowConnectedValuesBySchemaPath({')) {
      throw new Error(`expected ${label} runtime to avoid local connected-value recomputation`)
    }
  }
  if (!three.includes('connectedValuesByNodeId: richMediaConnectedValuesByNodeId')) {
    throw new Error('expected 3D/XR/Voxel overlays to pass connected Rich Media values into the shared overlay pool')
  }
  if (!three.includes('renderMediaAsNodes: store.renderMediaAsNodes') || !three.includes('selectedNodeId: s.selectedNodeId') || !three.includes('selectedNodeIds: s.selectedNodeIds')) {
    throw new Error('expected 3D/XR/Voxel overlay memoization to include display-control and selection dependencies')
  }
  if (!design.includes('resolveRichMediaPanelInteractive({')) {
    throw new Error('expected Design Rich Media overlays to reuse shared interactivity policy')
  }
}
