import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetPaletteExposesImageAndVideoWidgetsWithReadyRunDefaults() {
  const paletteText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/WidgetPalette.tsx'), 'utf8')
  const floatingPanelText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/FloatingPropsPanel.tsx'), 'utf8')
  const canvasText = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas.tsx'), 'utf8')
  const copyText = readFileSync(resolve(process.cwd(), 'src/lib/config-copy/uiMeta.ts'), 'utf8')

  const paletteSnippets = [
    'FLOW_IMAGE_GENERATION_NODE_LABEL',
    'FLOW_RICH_MEDIA_PANEL_NODE_LABEL',
    'FLOW_TEXT_GENERATION_NODE_LABEL',
    'FLOW_VIDEO_GENERATION_NODE_LABEL',
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

  const canvasSnippets = [
    'readActiveFlowWidgetPointerDragSession',
    "document.addEventListener('pointerup', onPointerUpCapture, true)",
    'const pendingOpenWidgetNodeIdRef = React.useRef<string | null>(null)',
    'pendingOpenWidgetNodeIdRef.current = id',
    'properties.model = CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT',
    "properties.prompt = 'Generate an image responsive to the active request.'",
    'FLOW_RICH_MEDIA_PANEL_NODE_LABEL',
    "outputSrcDoc: ''",
    'const providerFamily = inferTextGenerationProviderFamily({',
    'const nextTextProperties = resolveTextGenerationGlobalDefaultsForProviderFamily({',
    "prompt: 'Generate a text response for the active request.'",
    "output: ''",
    'properties.model = CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT',
    "properties.prompt = 'Generate a video responsive to the active request.'",
  ]
  for (const snippet of canvasSnippets) {
    if (!canvasText.includes(snippet)) {
      throw new Error(`expected ready-to-Run widget drop default snippet: ${snippet}`)
    }
  }

  if (!copyText.includes("flowWidget: 'Widget'")) {
    throw new Error('expected shared UI metadata to rename Widget to Widget')
  }
}
