import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetPaletteExposesImageAndVideoWidgetsWithReadyRunDefaults() {
  const paletteText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/WidgetPalette.tsx'), 'utf8')
  const floatingPanelText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/FloatingPropsPanel.tsx'), 'utf8')
  const canvasRuntimeText = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas.runtime.tsx'), 'utf8')
  const widgetDropBridgeText = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorWidgetDropBridge.ts'), 'utf8')
  const flowEditorConfigText = readFileSync(resolve(process.cwd(), 'src/lib/config.flow-editor.ts'), 'utf8')
  const imageDefaultsText = readFileSync(resolve(process.cwd(), 'src/features/integrations/byteplusImageGenerationDefaults.ts'), 'utf8')
  const videoDefaultsText = readFileSync(resolve(process.cwd(), 'src/features/integrations/byteplusVideoGenerationDefaults.ts'), 'utf8')
  const copyText = readFileSync(resolve(process.cwd(), 'src/lib/config-copy/uiMeta.ts'), 'utf8')

  const paletteSnippets = [
    'getWidgetRegistryEntryLabel',
    'beginFlowWidgetPointerDragSession',
    'markFlowWidgetPointerDragNativeStart',
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

  const canvasRuntimeSnippets = [
    'useFlowEditorWidgetDropBridge',
    'const pendingOpenWidgetNodeIdRef = React.useRef<string | null>(null)',
    'const { addNodeFromRegistryAtWorld } = useFlowEditorWidgetDropBridge({',
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

  const defaultHelperSnippets = [
    [imageDefaultsText, 'CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT', 'image model default'],
    [imageDefaultsText, 'export function buildBytePlusImageWidgetSeedProperties', 'image seed helper'],
    [imageDefaultsText, 'model: defaults.model', 'image seed model'],
    [flowEditorConfigText, "FLOW_TEXT_GENERATION_SEED_PROMPT_DEFAULT = 'Generate a text response for the active request.'", 'text seed default'],
    [flowEditorConfigText, 'export function getFlowTextGenerationSeedPrompt', 'text seed helper'],
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
