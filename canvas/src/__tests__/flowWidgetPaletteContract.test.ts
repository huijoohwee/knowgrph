import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensureDefaultWidgetRegistryEntries } from '@/hooks/store/storyboardWidgetManagerSlice'
import {
  getWidgetRegistryEntryLabel,
  isPropsPanelWidgetPaletteEntry,
} from '@/features/storyboard-widget-manager/registryTemplates'

export function testFlowWidgetPaletteExposesImageAndVideoWidgetsWithReadyRunDefaults() {
  const paletteText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/WidgetPalette.tsx'), 'utf8')
  const floatingPanelText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/FloatingPropsPanel.tsx'), 'utf8')
  const floatingPanelModelText = readFileSync(resolve(process.cwd(), 'src/lib/toolbar/useFloatingPropsPanelModel.impl.ts'), 'utf8')
  const floatingPanelAddNodeText = readFileSync(resolve(process.cwd(), 'src/lib/toolbar/floatingPropsPanelAddNode.ts'), 'utf8')
  const canvasViewportText = readFileSync(resolve(process.cwd(), 'src/components/CanvasViewport.tsx'), 'utf8')
  const canvasRuntimeText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas.runtime.tsx'), 'utf8')
  const widgetDropBridgeText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetDropBridge.ts'), 'utf8')
  const widgetGraphActionsText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetGraphActions.ts'), 'utf8')
  const bridgeOnlyText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetDropBridge.tsx'), 'utf8')
  const storyboardWidgetConfigText = readFileSync(resolve(process.cwd(), 'src/lib/config.storyboard-widget.ts'), 'utf8')
  const imageDefaultsText = readFileSync(resolve(process.cwd(), 'src/features/integrations/byteplusImageGenerationDefaults.ts'), 'utf8')
  const videoDefaultsText = readFileSync(resolve(process.cwd(), 'src/features/integrations/byteplusVideoGenerationDefaults.ts'), 'utf8')
  const copyText = readFileSync(resolve(process.cwd(), 'src/lib/config-copy/uiMeta.ts'), 'utf8')

  const paletteSnippets = [
    'getWidgetRegistryEntryLabel',
    'beginFlowWidgetPointerDragSession',
    'nodeTypeId: entry.nodeTypeId',
    'widgetTypeId: entry.widgetTypeId',
    'formId: entry.formId',
    'markFlowWidgetPointerDragNativeStart',
    'dispatchFlowWidgetPointerDragDropFromSession',
    'clearActiveFlowWidgetPointerDragSession',
    'aria-label="Widget palette"',
    '>Widgets<',
    'ready-to-Run widget node',
  ]
  for (const snippet of paletteSnippets) {
    if (!paletteText.includes(snippet)) {
      throw new Error(`expected widget palette contract snippet: ${snippet}`)
    }
  }
  if (!floatingPanelText.includes('const widgetDragEnabled = widgetPaletteEntries.length > 0')) {
    throw new Error('expected floating props panel widget drag to stay enabled whenever widget palette entries are available')
  }
  if (!floatingPanelText.includes('filter(isPropsPanelWidgetPaletteEntry)')) {
    throw new Error('expected FloatingPanel Props Panel to filter palette entries through the shared neutral palette helper')
  }
  const sharedAddNodeSnippets = [
    [floatingPanelAddNodeText, 'export function buildFloatingPropsPanelAddedNode', 'shared add-node builder'],
    [floatingPanelAddNodeText, 'export function commitFloatingPropsPanelAddedNode', 'shared add-node commit'],
    [floatingPanelModelText, 'buildFloatingPropsPanelAddedNode({ schema, type: newType, label: newLabel, point: center, pinToPoint: true })', 'Props Panel Add Node builder reuse'],
    [floatingPanelModelText, 'commitFloatingPropsPanelAddedNode({', 'Props Panel Add Node commit reuse'],
    [widgetGraphActionsText, 'buildFloatingPropsPanelAddedNode({', 'storyboard widget builder reuse'],
    [widgetGraphActionsText, 'commitFloatingPropsPanelAddedNode({', 'storyboard widget commit reuse'],
    [bridgeOnlyText, 'buildFloatingPropsPanelAddedNode({', 'bridge-only widget builder reuse'],
    [bridgeOnlyText, 'commitFloatingPropsPanelAddedNode({', 'bridge-only widget commit reuse'],
  ] as const
  for (const [text, snippet, label] of sharedAddNodeSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected ${label}: ${snippet}`)
    }
  }
  if (!canvasViewportText.includes('const bridgeOnlyWidgetDropActive = !documentSwitchBlocksCanvas')
    || !canvasViewportText.includes("active2dSurface !== 'storyboard'")
    || !canvasViewportText.includes('<StoryboardWidgetDropBridgeLazy active={false} widgetDropCaptureEnabled />')) {
    throw new Error('expected normal 2D canvas surfaces to mount the lightweight widget drop bridge used by the Props Panel palette')
  }
  const seededPalette = ensureDefaultWidgetRegistryEntries([], '2026-07-09T00:00:00.000Z')
    .entries
    .filter(isPropsPanelWidgetPaletteEntry)
  const paletteLabels = seededPalette.map(entry => getWidgetRegistryEntryLabel(entry))
  const expectedLabels = ['Image Widget', 'Rich Media Panel', 'Text Widget', 'Video Widget']
  const actualLabelSet = new Set(paletteLabels)
  for (const label of expectedLabels) {
    if (!actualLabelSet.has(label)) throw new Error(`expected neutral Props Panel palette label: ${label}`)
  }
  if (paletteLabels.length !== expectedLabels.length) {
    throw new Error(`expected only neutral core Props Panel palette entries, got ${paletteLabels.join(', ')}`)
  }
  for (const forbidden of ['BytePlus', 'OpenAI', 'DeerFlow', 'GrabMaps', 'Video Script', 'HTML Video Renderer', 'Video Transcriber', 'Storyboard Element']) {
    if (paletteLabels.some(label => label.includes(forbidden))) {
      throw new Error(`expected neutral Props Panel palette to omit ${forbidden}, got ${paletteLabels.join(', ')}`)
    }
  }

  const canvasRuntimeSnippets = [
    'useStoryboardWidgetDropBridge',
    'const pendingOpenWidgetNodeIdRef = React.useRef<string | null>(null)',
    'addNodeFromRegistryAtWorld',
    'useStoryboardWidgetDropBridge({',
    'pendingOpenWidgetNodeIdRef,',
  ]
  for (const snippet of canvasRuntimeSnippets) {
    if (!canvasRuntimeText.includes(snippet)) {
      throw new Error(`expected ready-to-Run widget runtime bridge snippet: ${snippet}`)
    }
  }

  const widgetDropBridgeSnippets = [
    'readActiveFlowWidgetPointerDragSession',
    "document.addEventListener('pointerup', onPointerUpCapture, true)",
    'FLOW_WIDGET_POINTER_DRAG_DROP_EVENT',
    'window.addEventListener(FLOW_WIDGET_POINTER_DRAG_DROP_EVENT, onFlowWidgetPointerDragDropCapture, true)',
    'commitFlowWidgetPointerDrop',
    'isFlowWidgetPointerDropDistanceAccepted',
    'readStoryboardWidgetDropRect({',
    'resolveWidgetRegistryEntryForDrop(args.widgetRegistryRef.current || [], payload)',
    'resolveWidgetRegistryEntryForDrop(args.widgetRegistryRef.current || [], session)',
    'appendDraftNode: (args: {',
    'args.appendDraftNode({ id: requestedId',
    'pendingOpenWidgetNodeIdRef.current = actualId',
    'buildBytePlusImageWidgetSeedProperties({',
    "prompt: 'Generate an image responsive to the active request.'",
    'FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID',
    "outputSrcDoc: ''",
    'FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID',
    "sourceUrl: ''",
    'const providerFamily = inferTextGenerationProviderFamily({',
    'const nextTextProperties = resolveTextGenerationGlobalDefaultsForProviderFamily({',
    'readGrabMapsDiscoveryWidgetProperties()',
    'readGeospatialCursorLngLat()',
    'syncGrabMapsDiscoveryGeoFromDropCursor',
    'requestGeospatialCurrentLocation',
    'readFiniteGeoLatLng',
    'properties.geo = {',
    'setGeospatialModeEnabled(true)',
    'getWidgetRegistryEntryLabel({',
    'prompt: getFlowTextGenerationSeedPrompt(entry.formId)',
    "output: ''",
    'buildBytePlusVideoWidgetSeedProperties({',
    "prompt: 'Generate a video responsive to the active request.'",
  ]
  for (const snippet of widgetDropBridgeSnippets) {
    if (!widgetDropBridgeText.includes(snippet)) {
      throw new Error(`expected ready-to-Run widget drop default snippet: ${snippet}`)
    }
  }
  if (widgetDropBridgeText.includes('if (session.nativeDragStarted) return')) {
    throw new Error('expected widget pointer fallback to materialize native drag releases instead of returning before drop creation')
  }

  const defaultHelperSnippets = [
    [imageDefaultsText, 'CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT', 'image model default'],
    [imageDefaultsText, 'export function buildBytePlusImageWidgetSeedProperties', 'image seed helper'],
    [imageDefaultsText, 'model: defaults.model', 'image seed model'],
    [storyboardWidgetConfigText, "FLOW_TEXT_GENERATION_SEED_PROMPT_DEFAULT = 'Generate a text response for the active request.'", 'text seed default'],
    [storyboardWidgetConfigText, 'export function getFlowTextGenerationSeedPrompt', 'text seed helper'],
    [videoDefaultsText, 'CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT', 'video model default'],
    [videoDefaultsText, 'export function buildBytePlusVideoWidgetSeedProperties', 'video seed helper'],
    [videoDefaultsText, 'model: defaults.model', 'video seed model'],
  ] as const
  for (const [text, snippet, label] of defaultHelperSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected ready-to-Run widget ${label} snippet: ${snippet}`)
    }
  }

  if (!copyText.includes("flowWidget: 'Widget'")) {
    throw new Error('expected shared UI metadata to rename Widget to Widget')
  }
}
