import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PerspectiveCamera, type WebGLRenderer } from 'three'

import { ensureDefaultWidgetRegistryEntries } from '@/hooks/store/storyboardWidgetManagerSlice'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import { FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/storyboard-widget-manager/resolveWidgetRegistry'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { defaultSchema } from '@/lib/graph/schema'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import {
  computeRichMediaOverlayConnectedValuesByNodeId,
  listDisplayRichMediaOverlayNodes,
} from '@/lib/render/richMediaSsot'
import {
  createThreeMediaOverlayLayoutScratch,
  updateThreeMediaOverlayLayout,
} from '@/lib/three/threeRichMediaOverlayLayout'

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
    ['2D:D3:block:document', { renderMediaAsNodes: true, canvasRenderMode: '2d', canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['2D:Flowchart:radial:keyword', { renderMediaAsNodes: true, canvasRenderMode: '2d', canvas2dRenderer: 'flowchart', frontmatterModeEnabled: false, documentSemanticMode: 'keyword' }],
    ['2D:FlowCanvas:block:document-structure', { renderMediaAsNodes: true, canvasRenderMode: '2d', canvas2dRenderer: 'flow', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['2D:Design:block:multi-dimensional-table', { renderMediaAsNodes: true, canvasRenderMode: '2d', canvas2dRenderer: 'design', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['2D:StoryboardWidget:frontmatter-forced-display', { renderMediaAsNodes: false, canvasRenderMode: '2d', canvas2dRenderer: 'storyboard', frontmatterModeEnabled: true, documentSemanticMode: 'document' }],
    ['Surface:3D:display-control', { renderMediaAsNodes: true, canvasRenderMode: '3d', canvas3dMode: '3d', canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['Surface:XR:display-control', { renderMediaAsNodes: true, canvasRenderMode: '3d', canvas3dMode: 'xr', canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['Surface:Voxel:display-control', { renderMediaAsNodes: true, canvasRenderMode: '3d', canvas3dMode: 'voxel', canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
    ['Surface:Geospatial:display-control', { renderMediaAsNodes: true, canvasSurfaceMode: 'geospatial', canvas2dRenderer: 'd3', frontmatterModeEnabled: false, documentSemanticMode: 'document' }],
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
  const threeGraph = readFileSync(resolve(root, 'src', 'lib', 'three', 'ThreeGraph.impl.tsx'), 'utf8')
  const design = readFileSync(resolve(root, 'src', 'components', 'DesignCanvas', 'MediaOverlay.tsx'), 'utf8')
  const sharedPanelSurface = readFileSync(resolve(root, 'src', 'components', 'useRichMediaPanelSurfaceState.ts'), 'utf8')
  const sharedLayoutLoop = readFileSync(resolve(root, 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts'), 'utf8')

  if (!ssot.includes('export function computeRichMediaOverlayConnectedValuesByNodeId')) {
    throw new Error('expected connected Rich Media overlay value derivation to live in the Rich Media SSOT')
  }
  if (!ssot.includes('export function resolveRichMediaSurfaceMode') || !ssot.includes("return 'geospatial'")) {
    throw new Error('expected Rich Media SSOT to own surface-mode resolution for 2D, 3D, XR, Voxel, and Geospatial')
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
  if (!three.includes('panelChrome="storyboardWidget"') || !three.includes('overlayId={n.id}')) {
    throw new Error('expected 3D/XR/Voxel Rich Media overlays to reuse the shared 2D panel chrome and overlay identity')
  }
  for (const snippet of ['readCanvasAspectRatioWidthToHeight', 'strybldrStoryboardCardAspectMode', 'directMediaZoomContentSize']) {
    if (!sharedPanelSurface.includes(snippet)) throw new Error(`expected shared Rich Media panel surface to reuse Canvas Aspect display control: ${snippet}`)
  }
  if (sharedPanelSurface.includes('{ h: 9, w: 16 }')) throw new Error('expected shared Rich Media panel surface to avoid hardcoded 16:9 direct media viewport size')
  for (const snippet of ['aspectRatioMode?: unknown', 'resolveCanvasAspectRatioSize({ defaultWidth: useSizing.panelW', 'aspectRatioMode: strybldrStoryboardCardAspectMode']) {
    if (!(sharedLayoutLoop.includes(snippet) || d3Hook.includes(snippet))) throw new Error(`expected shared Rich Media layout fallback to reuse Canvas Aspect display control: ${snippet}`)
  }
  for (const snippet of [
    'computePanelFrameResizeFromDrag16x9({',
    'readRichMediaPanelFrameMetrics(el)',
    'readStableRichMediaPanelSize(readNodeProperties(id))',
    "'visual:width': drag.lastW",
    "'visual:height': drag.lastH",
    'localPinnedRef.current[id]',
    'localScreenAnchorsRef.current[id]',
    'localPanelSizesRef.current[id]',
    'localPositionsRef.current[n.id]',
    "'visual:zIndex':",
    'resizable={true}',
    'widgetToolbarActive={true}',
    'headerPinned={readPanelPinned(n.id)}',
    'onHeaderTogglePinned={event =>',
    'onHeaderValidate={() => bringToFront(n.id)}',
    'onHeaderToggleMinimized={() => togglePanelSize(n.id)}',
    'const stopPanelChromeSafeEvent = React.useCallback',
    "target?.closest('button,a,input,textarea,select,[role=\"button\"],[data-kg-rich-media-resize-handle=\"1\"]')",
    'onClickCapture={stopPanelChromeSafeEvent}',
    'forwardWheelBeforeScrollableTarget={store.infiniteCanvasInteractionMode !==',
  ]) {
    if (!three.includes(snippet)) {
      throw new Error(`expected 3D/XR/Voxel Rich Media overlays to reuse shared pan/drag/zoom/resize utility: ${snippet}`)
    }
  }
  const threeLayout = readFileSync(resolve(root, 'src', 'lib', 'three', 'threeRichMediaOverlayLayout.ts'), 'utf8')
  if (!threeLayout.includes('getPanelSizeForId?:') || !threeLayout.includes('const overrideSize = typeof args.getPanelSizeForId')) {
    throw new Error('expected 3D Rich Media layout to reuse persisted visual panel sizing like 2D overlays')
  }
  if (!threeLayout.includes('getPanelPinnedForId?:') || !threeLayout.includes('getPanelScreenAnchorForId?:') || !threeLayout.includes('getPanelZIndexForId?:')) {
    throw new Error('expected 3D Rich Media layout to reuse shared pin, screen-position, and z-index state')
  }
  if (!threeLayout.includes('opacity: 1,')) {
    throw new Error('expected 3D Rich Media layout to keep media panels opaque instead of depth-fading them under 3D nodes')
  }
  if (!threeGraph.includes('sceneGraphForRender') || !threeGraph.includes('edges: []')) {
    throw new Error('expected ThreeGraph to keep node-only media graphs renderable for 3D Rich Media overlays')
  }
  if (!three.includes('renderMediaAsNodes: store.renderMediaAsNodes') || !three.includes('canvas3dMode: store.canvas3dMode') || !three.includes('selectedNodeId: s.selectedNodeId') || !three.includes('selectedNodeIds: s.selectedNodeIds')) {
    throw new Error('expected 3D/XR/Voxel overlay memoization to include display-control and selection dependencies')
  }
  if (!design.includes('resolveRichMediaPanelInteractive({')) {
    throw new Error('expected Design Rich Media overlays to reuse shared interactivity policy')
  }
}

function makeRichMediaPanelElement(): HTMLElement {
  const style: Record<string, string | ((key: string, value: string) => void)> = {
    left: '-99999px',
    top: '-99999px',
    setProperty(key: string, value: string) {
      style[key] = value
    },
  }
  return {
    dataset: {},
    style,
    getAttribute: () => null,
    querySelector: () => null,
  } as unknown as HTMLElement
}

export function testThreeRichMediaLayoutStacksOverlappingPanelsByScreenPositionAndSelection() {
  const camera = new PerspectiveCamera(50, 960 / 640, 0.1, 1000)
  camera.position.set(0, 0, 220)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
  const upper = makeRichMediaPanelElement()
  const lower = makeRichMediaPanelElement()
  updateThreeMediaOverlayLayout({
    camera,
    gl: { domElement: { clientWidth: 960, clientHeight: 640 } } as unknown as WebGLRenderer,
    overlayNodesPool: [{ id: 'upper-media' }, { id: 'lower-media' }],
    positions: { 'upper-media': [0, 12, 0], 'lower-media': [0, -12, 0] },
    dragOverrides: {},
    overlayEls: new Map([['upper-media', upper], ['lower-media', lower]]),
    missFrames: new Map(),
    prevVisibleIds: new Set(),
    effectiveSchema: defaultSchema,
    scratch: createThreeMediaOverlayLayoutScratch(),
    getPanelSizeForId: () => ({ w: 320, h: 220 }),
    mediaPanelDensity: 'default',
    threeIframeOverlayMaxVisibleDefault: 8,
    threeIframeOverlayMaxDistanceDefault: 620,
    threeIframeOverlayBaseWidthRatioDefault: 0.2,
    threeIframeOverlayBaseWidthMinPxDefault: 210,
    threeIframeOverlayBaseWidthMaxPxDefault: 360,
    threeIframeOverlaySizeScaleFactor: 260,
  })
  const upperZ = Number.parseFloat(String((upper.style as unknown as Record<string, string>).zIndex || '0'))
  const lowerZ = Number.parseFloat(String((lower.style as unknown as Record<string, string>).zIndex || '0'))
  if (!(lowerZ > upperZ)) {
    throw new Error(`expected lower overlapping 3D Rich Media panel to stack above upper panel, got ${upperZ} ${lowerZ}`)
  }

  updateThreeMediaOverlayLayout({
    camera,
    gl: { domElement: { clientWidth: 960, clientHeight: 640 } } as unknown as WebGLRenderer,
    overlayNodesPool: [{ id: 'upper-media' }, { id: 'lower-media' }],
    positions: { 'upper-media': [0, 12, 0], 'lower-media': [0, -12, 0] },
    dragOverrides: {},
    overlayEls: new Map([['upper-media', upper], ['lower-media', lower]]),
    missFrames: new Map(),
    prevVisibleIds: new Set(['upper-media', 'lower-media']),
    effectiveSchema: defaultSchema,
    scratch: createThreeMediaOverlayLayoutScratch(),
    getPanelSizeForId: () => ({ w: 320, h: 220 }),
    selectedNodeId: 'upper-media',
    mediaPanelDensity: 'default',
    threeIframeOverlayMaxVisibleDefault: 8,
    threeIframeOverlayMaxDistanceDefault: 620,
    threeIframeOverlayBaseWidthRatioDefault: 0.2,
    threeIframeOverlayBaseWidthMinPxDefault: 210,
    threeIframeOverlayBaseWidthMaxPxDefault: 360,
    threeIframeOverlaySizeScaleFactor: 260,
  })
  const selectedUpperZ = Number.parseFloat(String((upper.style as unknown as Record<string, string>).zIndex || '0'))
  const selectedLowerZ = Number.parseFloat(String((lower.style as unknown as Record<string, string>).zIndex || '0'))
  if (!(selectedUpperZ > selectedLowerZ)) {
    throw new Error(`expected selected overlapping 3D Rich Media panel to stack above screen-position ordering, got ${selectedUpperZ} ${selectedLowerZ}`)
  }
}

export function testThreeRichMediaLayoutKeepsUnanchoredPanelsVisible() {
  const camera = new PerspectiveCamera(50, 960 / 640, 0.1, 1000)
  camera.position.set(0, 0, 220)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
  const el = makeRichMediaPanelElement()
  const visible = updateThreeMediaOverlayLayout({
    camera,
    gl: { domElement: { clientWidth: 960, clientHeight: 640 } } as unknown as WebGLRenderer,
    overlayNodesPool: [{ id: 'rich-media-panel' }],
    positions: {},
    dragOverrides: {},
    overlayEls: new Map([['rich-media-panel', el]]),
    missFrames: new Map(),
    prevVisibleIds: new Set(),
    effectiveSchema: defaultSchema,
    scratch: createThreeMediaOverlayLayoutScratch(),
    getPanelSizeForId: id => id === 'rich-media-panel' ? { w: 320, h: 220 } : null,
    mediaPanelDensity: 'default',
    threeIframeOverlayMaxVisibleDefault: 8,
    threeIframeOverlayMaxDistanceDefault: 620,
    threeIframeOverlayBaseWidthRatioDefault: 0.2,
    threeIframeOverlayBaseWidthMinPxDefault: 210,
    threeIframeOverlayBaseWidthMaxPxDefault: 360,
    threeIframeOverlaySizeScaleFactor: 260,
  })
  if (!visible.has('rich-media-panel')) {
    throw new Error('expected 3D Rich Media layout to keep enabled unanchored panels visible')
  }
  const style = el.style as unknown as Record<string, string>
  if (style.display !== 'block') throw new Error(`expected visible panel display block, got ${String(style.display)}`)
  if (!String(style.transform || '').includes('translate3d(') || String(style.transform || '').includes('-99999')) {
    throw new Error(`expected viewport-anchored panel transform, got ${String(style.transform || '')}`)
  }
  if (style.left !== '0px' || style.top !== '0px') {
    throw new Error(`expected visible panel to reset stale offscreen origin, got ${String(style.left)} ${String(style.top)}`)
  }
  if (Number.parseFloat(String(style.width || '0')) !== 320 || Number.parseFloat(String(style.height || '0')) !== 220) {
    throw new Error(`expected 3D Rich Media panel to receive viewport size, got ${String(style.width)} x ${String(style.height)}`)
  }
}
