import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'
import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import { ensureDefaultWidgetRegistryEntries } from '@/hooks/store/flowEditorManagerSlice'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import { FLOW_IMAGE_GENERATION_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID, FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { defaultSchema } from '@/lib/graph/schema'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'

export function testRichMediaPanelRendersConnectedTextWidgetOutput() {
  const node = {
    id: 'rich-media-panel-1',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {},
  } as Parameters<typeof getNodeMediaSpec>[0]

  const effectiveNode = applyConnectedValuesToNodeForRender({
    node,
    connectedValuesBySchemaPath: {
      'properties.output': {
        value: '## Hello from widget',
        sources: [],
      },
    },
  })

  const spec = getNodeMediaSpec(effectiveNode)
  if (!spec) throw new Error('expected rich media panel to render connected widget output')
  if (spec.kind !== 'iframe') throw new Error(`expected rich media panel connected text output to render as iframe, got ${String(spec.kind)}`)
  if (!String(spec.srcDoc || '').includes('Hello from widget')) {
    throw new Error('expected rich media panel connected text output to become rich media srcdoc content')
  }
}

export function testRichMediaPanelEmptyPanelIsRenderableOverlayShell() {
  const node = {
    id: 'rich-media-panel-empty',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {},
  } as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected empty rich media panel to stay renderable as overlay shell')
  if (spec.kind !== 'iframe') throw new Error(`expected empty rich media panel to default to iframe shell, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== '') throw new Error('expected empty rich media panel to have no url by default')
}

export function testRichMediaPanelConnectedTextOverridesStaleImageRenderState() {
  const node = {
    id: 'rich-media-panel-stale-image',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {
      imageUrl: 'https://example.com/stale-image.png',
      videoUrl: 'https://example.com/stale-video.mp4',
    },
  } as Parameters<typeof getNodeMediaSpec>[0]

  const effectiveNode = applyConnectedValuesToNodeForRender({
    node,
    connectedValuesBySchemaPath: {
      'properties.output': {
        value: 'Connected text wins',
        sources: [],
      },
    },
  })

  const spec = getNodeMediaSpec(effectiveNode)
  if (!spec) throw new Error('expected connected text to keep rich media panel renderable')
  if (spec.kind !== 'iframe') throw new Error(`expected connected text to override stale image/video and render as iframe, got ${String(spec.kind)}`)
  if (!String(spec.srcDoc || '').includes('Connected text wins')) {
    throw new Error('expected connected text output to replace stale image/video render state')
  }
}

export function testRichMediaPanelConnectedVideoOverridesStaleTextRenderState() {
  const node = {
    id: 'rich-media-panel-stale-text',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {
      output: 'stale text output',
      outputSrcDoc: '<html><body>stale</body></html>',
    },
  } as Parameters<typeof getNodeMediaSpec>[0]

  const effectiveNode = applyConnectedValuesToNodeForRender({
    node,
    connectedValuesBySchemaPath: {
      'properties.videoUrl': {
        value: 'https://example.com/generated-video.mp4',
        sources: [],
      },
    },
  })

  const spec = getNodeMediaSpec(effectiveNode)
  if (!spec) throw new Error('expected connected video to keep rich media panel renderable')
  if (spec.kind !== 'video') throw new Error(`expected connected video to override stale text render state, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== 'https://example.com/generated-video.mp4') {
    throw new Error('expected connected video url to become the rich media panel render target')
  }
}

export function testRichMediaPanelMapsGenericOutputConnectionFromImageSourcePort() {
  const node = {
    id: 'rich-media-panel-generic-output-image',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {},
  } as Parameters<typeof getNodeMediaSpec>[0]

  const effectiveNode = applyConnectedValuesToNodeForRender({
    node,
    connectedValuesBySchemaPath: {
      'properties.output': {
        value: 'https://example.com/generated-image.png',
        sources: [{ edgeId: 'edge-1', nodeId: 'source-image', portKey: 'imageUrl' }],
      },
    },
  })

  const spec = getNodeMediaSpec(effectiveNode)
  if (!spec) throw new Error('expected generic output connection from image source port to stay renderable')
  if (spec.kind !== 'image') throw new Error(`expected generic output connection from image source port to render as image, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== 'https://example.com/generated-image.png') {
    throw new Error('expected generic output connection from image source port to map into rich media image render path')
  }
}

export function testRichMediaPanelMapsGenericOutputConnectionFromVideoSourcePort() {
  const node = {
    id: 'rich-media-panel-generic-output-video',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {},
  } as Parameters<typeof getNodeMediaSpec>[0]

  const effectiveNode = applyConnectedValuesToNodeForRender({
    node,
    connectedValuesBySchemaPath: {
      'properties.output': {
        value: 'https://example.com/generated-video.mp4',
        sources: [{ edgeId: 'edge-2', nodeId: 'source-video', portKey: 'videoUrl' }],
      },
    },
  })

  const spec = getNodeMediaSpec(effectiveNode)
  if (!spec) throw new Error('expected generic output connection from video source port to stay renderable')
  if (spec.kind !== 'video') throw new Error(`expected generic output connection from video source port to render as video, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== 'https://example.com/generated-video.mp4') {
    throw new Error('expected generic output connection from video source port to map into rich media video render path')
  }
}

export function testRichMediaPanelReusesMarkdownImageRenderingFromOutputText() {
  const node = {
    id: 'rich-media-panel-output-markdown-image',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {
      output: '![Generated image](https://example.com/generated-image.png)',
    },
  } as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected markdown image output text to render in Rich Media Panel')
  if (spec.kind !== 'image') throw new Error(`expected markdown image output text to reuse image rendering, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== 'https://example.com/generated-image.png') {
    throw new Error('expected markdown image output text to resolve to the image url')
  }
}

export function testRichMediaPanelReusesMarkdownLinkIframeRenderingFromOutputText() {
  const node = {
    id: 'rich-media-panel-output-markdown-link',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {
      output: '[Reference](https://example.com/embed)',
    },
  } as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (!spec) throw new Error('expected markdown link output text to render in Rich Media Panel')
  if (spec.kind !== 'iframe') throw new Error(`expected markdown link output text to reuse iframe rendering, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== 'https://example.com/embed') {
    throw new Error('expected markdown link output text to resolve to the iframe url')
  }
}

function runWidgetToRichMediaPanelPipeline(args: {
  sourceNodeTypeId: string
  sourceFormId: string
  sourceOutputPortKey: string
  sourceOutputValue: unknown
}): ReturnType<typeof getNodeMediaSpec> {
  const seeded = ensureDefaultWidgetRegistryEntries([], '2026-04-22T00:00:00.000Z').entries
  const graphData = {
    type: 'GraphData',
    nodes: [
      {
        id: 'source-widget',
        type: args.sourceNodeTypeId,
        label: 'Source Widget',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: args.sourceFormId,
          'flow:portTypes': {
            in: {},
            out: {
              [args.sourceOutputPortKey]:
                args.sourceOutputPortKey === 'text_out'
                  ? 'TEXT'
                  : args.sourceOutputPortKey === 'imageUrl'
                    ? 'IMAGE_URL'
                    : 'VIDEO_URL',
            },
          },
          ...(args.sourceOutputPortKey === 'text_out'
            ? { output: args.sourceOutputValue }
            : args.sourceOutputPortKey === 'imageUrl'
              ? { imageUrl: args.sourceOutputValue }
              : { videoUrl: args.sourceOutputValue }),
        },
      },
      {
        id: 'rich-media-panel',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        label: 'Rich Media Panel',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'richMediaPanel',
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
    edges: [],
    metadata: {},
  } as any

  const edgeResult = finalizeEdgeAuthoring({
    mode: 'create',
    data: graphData,
    schema: defaultSchema,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'source-widget', portKey: null },
    to: { nodeId: 'rich-media-panel', portKey: null },
  })
  if (edgeResult.kind !== 'create') throw new Error(`expected widget pipeline edge creation, got ${edgeResult.kind}`)

  const edgeProps = (edgeResult.edge.properties || {}) as Record<string, unknown>
  if (String(edgeProps['flow:sourcePortKey'] || '') !== args.sourceOutputPortKey) {
    throw new Error(`expected default source port ${args.sourceOutputPortKey}, got ${String(edgeProps['flow:sourcePortKey'] || '')}`)
  }
  const expectedTargetPortKey =
    args.sourceOutputPortKey === 'text_out'
      ? 'output'
      : args.sourceOutputPortKey === 'imageUrl'
        ? 'imageUrl'
        : 'videoUrl'
  if (String(edgeProps['flow:targetPortKey'] || '') !== expectedTargetPortKey) {
    throw new Error(`expected default rich media target port ${expectedTargetPortKey}, got ${String(edgeProps['flow:targetPortKey'] || '')}`)
  }

  const connectedByNodeId = computeFlowConnectedValuesBySchemaPath({
    graphData: {
      ...graphData,
      edges: [edgeResult.edge],
    } as any,
    registry: seeded,
  })
  const panelConnectedValues = connectedByNodeId.get('rich-media-panel')
  if (!panelConnectedValues) throw new Error('expected rich media panel connected values')

  const panelNode = (graphData.nodes as any[]).find(node => String(node.id || '') === 'rich-media-panel')
  const effectivePanelNode = applyConnectedValuesToNodeForRender({
    node: panelNode,
    connectedValuesBySchemaPath: panelConnectedValues,
  })
  return getNodeMediaSpec(effectivePanelNode)
}

export function testOpenAiTextWidgetPipelineRendersInRichMediaPanel() {
  const spec = runWidgetToRichMediaPanelPipeline({
    sourceNodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    sourceFormId: 'textGeneration.openai',
    sourceOutputPortKey: 'text_out',
    sourceOutputValue: '## OpenAI output',
  })
  if (!spec) throw new Error('expected OpenAI text widget pipeline to render in Rich Media Panel')
  if (spec.kind !== 'iframe') throw new Error(`expected OpenAI text widget pipeline to render as iframe text, got ${String(spec.kind)}`)
  if (!String(spec.srcDoc || '').includes('OpenAI output')) {
    throw new Error('expected OpenAI text widget pipeline to expose generated text in Rich Media Panel')
  }
}

export function testTextWidgetOutputDoesNotCompeteWithRichMediaPanelOverlay() {
  const graphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      {
        id: 'w-openai-text',
        type: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        label: 'OpenAI Text Widget',
        properties: {
          output: '## OpenAI output',
          outputSrcDoc: '<html><body>OpenAI output</body></html>',
          'flow:widgetFormId': 'textGeneration.openai',
        },
      },
      {
        id: 'p-rich-media',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        label: 'Rich Media Panel',
        properties: {
          'flow:widgetFormId': 'richMediaPanel',
        },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'w-openai-text',
        target: 'p-rich-media',
        properties: {
          'flow:sourcePortKey': 'text_out',
          'flow:targetPortKey': 'output',
        },
      },
    ],
    metadata: {},
  } as any
  const seeded = ensureDefaultWidgetRegistryEntries([]).entries
  const connectedByNodeId = computeFlowConnectedValuesBySchemaPath({
    graphData,
    registry: seeded,
  })
  const renderNodes = (graphData.nodes || []).map((node: any) => {
    const nodeId = String(node.id || '')
    return applyConnectedValuesToNodeForRender({
      node,
      connectedValuesBySchemaPath: connectedByNodeId.get(nodeId),
    })
  })
  const overlays = listMediaOverlayNodes({
    enabled: true,
    nodes: renderNodes,
    poolMax: 24,
    connectedValuesByNodeId: connectedByNodeId,
  })
  if (overlays.length !== 1) throw new Error(`expected only one overlay renderer for connected text output, got ${overlays.length}`)
  if (String(overlays[0]?.id || '') !== 'p-rich-media') {
    throw new Error(`expected Rich Media Panel to remain the single text overlay renderer, got ${String(overlays[0]?.id || '<none>')}`)
  }
}

export function testSeedreamImageWidgetPipelineRendersInRichMediaPanel() {
  const spec = runWidgetToRichMediaPanelPipeline({
    sourceNodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
    sourceFormId: 'imageGeneration',
    sourceOutputPortKey: 'imageUrl',
    sourceOutputValue: 'https://example.com/seedream-image.png',
  })
  if (!spec) throw new Error('expected Seedream image widget pipeline to render in Rich Media Panel')
  if (spec.kind !== 'image') throw new Error(`expected Seedream image widget pipeline to render as image, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== 'https://example.com/seedream-image.png') {
    throw new Error('expected Seedream image widget pipeline to expose generated image in Rich Media Panel')
  }
}

export function testBytePlusVideoWidgetPipelineRendersInRichMediaPanel() {
  const spec = runWidgetToRichMediaPanelPipeline({
    sourceNodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
    sourceFormId: 'videoGeneration',
    sourceOutputPortKey: 'videoUrl',
    sourceOutputValue: 'https://example.com/byteplus-video.mp4',
  })
  if (!spec) throw new Error('expected BytePlus video widget pipeline to render in Rich Media Panel')
  if (spec.kind !== 'video') throw new Error(`expected BytePlus video widget pipeline to render as video, got ${String(spec.kind)}`)
  if (String(spec.url || '') !== 'https://example.com/byteplus-video.mp4') {
    throw new Error('expected BytePlus video widget pipeline to expose generated video in Rich Media Panel')
  }
}

export function testFlowCanvasUsesConnectedValuesForRichMediaPanelOverlays() {
  const filePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(filePath, 'utf8')

  const requiredSnippets = [
    'computeFlowConnectedValuesBySchemaPath',
    'buildDataflowWidgetRegistry',
    'applyConnectedValuesToNodeForRender',
    'const mediaRenderNodes = React.useMemo(() => {',
    'connectedValuesByNodeId',
    'baseWidgetRegistry: s.widgetRegistry',
    'widgetRegistry: baseWidgetRegistry',
    'const nodes = mediaRenderNodes',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected FlowCanvas rich media overlay snippet: ${snippet}`)
    }
  }
}

export function testRichMediaPanelRegistryPortsExposeWidgetConnectionHandles() {
  const seeded = ensureDefaultWidgetRegistryEntries([], '2026-04-22T00:00:00.000Z').entries
  const handlesByNode = computeFlowHandlesByNode({
    nodes: [
      {
        id: 'rich-media-panel-ports',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'richMediaPanel',
        },
      },
    ],
    edges: [],
    widgetRegistry: seeded,
  })

  const handles = handlesByNode['rich-media-panel-ports']
  if (!handles) throw new Error('expected rich media panel handles to be computed')
  const inIds = new Set((handles.in || []).map(handle => handle.id))
  const outIds = new Set((handles.out || []).map(handle => handle.id))

  ;['in:output', 'in:imageUrl', 'in:videoUrl', 'in:outputSrcDoc'].forEach(id => {
    if (!inIds.has(id as never)) throw new Error(`expected rich media panel input handle ${id}`)
  })
  ;['out:output', 'out:imageUrl', 'out:videoUrl', 'out:outputSrcDoc'].forEach(id => {
    if (!outIds.has(id as never)) throw new Error(`expected rich media panel output handle ${id}`)
  })
}

export function testRichMediaPanelCanvasOverlayProxyAttrsAlignWithFlowWidget() {
  const filePath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(filePath, 'utf8')
  const requiredSnippets = [
    `data-kg-rich-media-overlay={canvasOverlayProxyEnabled ? '1' : undefined}`,
    `data-kg-canvas-overlay-pinned={canvasOverlayProxyEnabled ? '1' : undefined}`,
    `data-kg-canvas-wheel-ignore={canvasOverlayProxyEnabled ? 'true' : undefined}`,
    `data-kg-canvas-overlay-drag-handle={installHeaderDrag ? 'true' : undefined}`,
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected RichMediaPanel overlay proxy attr snippet: ${snippet}`)
    }
  }
  if (text.includes(`data-kg-canvas-pointer-ignore={canvasOverlayProxyEnabled ? 'true' : undefined}`)) {
    throw new Error('expected RichMediaPanel root overlay proxy attrs to avoid blanket canvas pointer-ignore and keep pointer routing owned by FlowCanvas drag/resize handlers')
  }
}

export function testRichMediaPanelPanDragUsesFlowCanvasRafLatestScheduler() {
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowCanvas = readFileSync(flowCanvasPath, 'utf8')
  const panelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const panel = readFileSync(panelPath, 'utf8')
  const requiredSnippets = [
    'createRafLatestScheduler',
    'mediaOverlayPanMoveSchedulerRef',
    'mediaOverlayHeaderMoveSchedulerRef',
    'mediaOverlayPanMoveSchedulerRef.current.schedule(args)',
    'mediaOverlayHeaderMoveSchedulerRef.current.schedule(next)',
    'mediaOverlayPanMoveSchedulerRef.current?.cancel()',
    'mediaOverlayHeaderMoveSchedulerRef.current?.cancel()',
  ]
  for (const snippet of requiredSnippets) {
    if (!flowCanvas.includes(snippet)) {
      throw new Error(`expected FlowCanvas drag/pan RAF scheduler snippet: ${snippet}`)
    }
  }
  if (panel.includes('createRafLatestScheduler')) {
    throw new Error('expected RichMediaPanel not to own drag/pan scheduler; scheduler SSOT must stay in FlowCanvas')
  }
}

export function testFlowCanvasRichMediaOverlayDragHandlersAreFlowEditorScoped() {
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(flowCanvasPath, 'utf8')
  const requiredSnippets = [
    "const flowEditorOverlayInteractionMode = canvas2dRenderer === 'flowEditor'",
    "onOverlayPanStart={flowEditorOverlayInteractionMode ?",
    "onOverlayPan={flowEditorOverlayInteractionMode ?",
    "onOverlayPanEnd={flowEditorOverlayInteractionMode ?",
    "onHeaderDragStart={flowEditorOverlayInteractionMode ?",
    "onHeaderDrag={flowEditorOverlayInteractionMode ?",
    "onHeaderDragEnd={flowEditorOverlayInteractionMode ?",
    "onResizeStart={flowEditorOverlayInteractionMode ?",
    "onResize={flowEditorOverlayInteractionMode ?",
    "onResizeEnd={flowEditorOverlayInteractionMode ?",
    "if (String(st.canvas2dRenderer || '') !== 'flowEditor') return false",
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected FlowCanvas Rich Media drag/pan Flow Editor guard snippet: ${snippet}`)
    }
  }
  if (text.includes('isFlowEditorFrontmatterInteractionMode')) {
    throw new Error('expected FlowCanvas Rich Media overlay drag runtime to remove stale frontmatter-only gate alias')
  }
}
