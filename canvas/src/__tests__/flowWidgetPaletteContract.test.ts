import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensureDefaultWidgetRegistryEntries } from '@/hooks/store/storyboardWidgetManagerSlice'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { isStoryboardFixedCardOwnedNode } from '@/components/StoryboardWidgetCanvas/storyboardCardOwnership2d'
import {
  getWidgetRegistryEntryLabel,
  isPropsPanelWidgetPaletteEntry,
} from '@/features/storyboard-widget-manager/registryTemplates'

export function testFlowWidgetPaletteConsolidatesMediaWidgetsIntoRichMediaPanel() {
  const paletteText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/WidgetPalette.tsx'), 'utf8')
  const floatingPanelText = readFileSync(resolve(process.cwd(), 'src/features/toolbar/FloatingPropsPanel.tsx'), 'utf8')
  const floatingPanelAddNodeText = readFileSync(resolve(process.cwd(), 'src/lib/toolbar/floatingPropsPanelAddNode.ts'), 'utf8')
  const canvasViewportText = readFileSync(resolve(process.cwd(), 'src/components/CanvasViewport.tsx'), 'utf8')
  const canvasRuntimeText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas.runtime.tsx'), 'utf8')
  const widgetDropBridgeText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetDropBridge.ts'), 'utf8')
  const widgetGraphActionsText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetGraphActions.ts'), 'utf8')
  const widgetSurfaceText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/StoryboardWidgetCanvasSurface.tsx'), 'utf8')
  const widgetSharedText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared.tsx'), 'utf8')
  const bridgeOnlyText = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetDropBridge.tsx'), 'utf8')
  const storyboardWidgetConfigText = readFileSync(resolve(process.cwd(), 'src/lib/config.storyboard-widget.ts'), 'utf8')
  const copyText = readFileSync(resolve(process.cwd(), 'src/lib/config-copy/uiMeta.ts'), 'utf8')

  const paletteSnippets = [
    'getWidgetRegistryEntryLabel',
    'beginFlowWidgetPointerDragSession',
    'nodeTypeId: entry.nodeTypeId',
    'widgetTypeId: entry.widgetTypeId',
    'formId: entry.formId',
    'markFlowWidgetPointerDragNativeStart',
    'dispatchFlowWidgetPointerDragDropFromSession',
    'eventType: ev.type',
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
  if (!floatingPanelText.includes('<WidgetPalette entries={widgetPaletteEntries} dragEnabled={widgetDragEnabled} />')
    || !floatingPanelText.includes('data-kg-props-panel-surface="widget-palette"')) {
    throw new Error('expected FloatingPanel Props Panel to delegate to the shared WidgetPalette as a palette-only surface')
  }
  for (const staleSnippet of [
    'CollapsibleSection',
    'title="Add"',
    'title="Node"',
    'title="Media"',
    'title="Layout"',
    'title="Edge"',
    'useFloatingPropsPanelModel',
    'FloatingPropsPanelProbeTreeButton',
    'PanelRangeInput',
    'PanelSelect',
    'PanelTextInput',
    'readPanelBooleanChoiceButtonClassName',
    'UI_COPY.propsPanel',
  ]) {
    if (floatingPanelText.includes(staleSnippet)) {
      throw new Error(`expected FloatingPanel Props Panel to omit stale section/control snippet: ${staleSnippet}`)
    }
  }
  const sharedAddNodeSnippets = [
    [floatingPanelAddNodeText, 'export function buildFloatingPropsPanelAddedNode', 'shared add-node builder'],
    [floatingPanelAddNodeText, 'export function commitFloatingPropsPanelAddedNode', 'shared add-node commit'],
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
  const expectedLabels = ['Rich Media Panel', 'Text Widget']
  const actualLabelSet = new Set(paletteLabels)
  for (const label of expectedLabels) {
    if (!actualLabelSet.has(label)) throw new Error(`expected neutral Props Panel palette label: ${label}`)
  }
  if (paletteLabels.length !== expectedLabels.length) {
    throw new Error(`expected Props Panel palette to consolidate media creation into Rich Media Panel and Text Widget, got ${paletteLabels.join(', ')}`)
  }
  for (const forbidden of ['Image Widget', 'Video Widget', 'BytePlus', 'OpenAI', 'DeerFlow', 'GrabMaps', 'Video Script', 'HTML Video Renderer', 'Video Transcriber', 'Storyboard Element']) {
    if (paletteLabels.some(label => label.includes(forbidden))) {
      throw new Error(`expected neutral Props Panel palette to omit ${forbidden}, got ${paletteLabels.join(', ')}`)
    }
  }
  const mediaPanelEntry = seededPalette.find(entry => getWidgetRegistryEntryLabel(entry) === 'Rich Media Panel')
  if (!mediaPanelEntry) throw new Error('expected consolidated Props Panel palette to expose Rich Media Panel as the media entry')
  const textWidgetEntry = seededPalette.find(entry => getWidgetRegistryEntryLabel(entry) === 'Text Widget')
  if (!textWidgetEntry) throw new Error('expected neutral Props Panel palette to expose Text Widget')
  const droppedTextWidgetNode = {
    id: 'dropped-text-widget',
    type: textWidgetEntry.nodeTypeId,
    label: 'Text Widget',
    properties: {
      'flow:widgetTypeId': textWidgetEntry.widgetTypeId,
      'flow:widgetFormId': textWidgetEntry.formId,
      prompt: 'Generate a text response for the active request.',
      output: '',
      title: 'Text Widget',
    },
  }
  const cardBoard = buildStoryboardBoardModel({
    graphData: {
      type: 'application/json',
      nodes: [
        { id: 'source-card', type: 'RuntimeProofGate', label: 'Source', properties: { lane: 'Source', summary: 'Reference source card.' } },
        droppedTextWidgetNode,
      ],
      edges: [{ id: 'source-to-text', source: 'source-card', target: 'dropped-text-widget', label: 'creates', properties: {} }],
    },
    graphRevision: 1,
    widgetRegistry: seededPalette,
  })
  const textWidgetCard = cardBoard.lanes.flatMap(lane => lane.cards).find(card => card.id === 'dropped-text-widget') || null
  if (!isStoryboardFixedCardOwnedNode(droppedTextWidgetNode)) {
    throw new Error('expected dropped Text Widget to be owned by the Storyboard Card overlay, not the Rich Media overlay path')
  }
  if (!textWidgetCard) throw new Error('expected dropped Text Widget to project into the Storyboard Card board')
  if (textWidgetCard.title !== 'Text Widget') throw new Error(`expected dropped Text Widget Card title, got ${textWidgetCard.title}`)
  if (textWidgetCard.lane !== 'Text Generation') throw new Error(`expected dropped Text Widget Card lane from node type, got ${textWidgetCard.lane}`)

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
  if (!canvasRuntimeText.includes('if (storyboardCardDisplayActive) return []')) {
    throw new Error('expected Storyboard Card display to suppress explicit open widget shell ids after Props Panel widget drops')
  }
  if (!widgetSurfaceText.includes('props.storyboardWidgetMode === true && Array.isArray(props.openWidgetNodeIds)')) {
    throw new Error('expected Storyboard surface to honor explicit open widget ids only in Widget display mode')
  }

  const widgetDropBridgeSnippets = [
    'readActiveFlowWidgetPointerDragSession',
    'resolveFlowWidgetDragEventReleaseClientPoint',
    'resolveFlowWidgetPointerReleaseClientPoint',
    "document.addEventListener('pointerup', onPointerUpCapture, true)",
    'FLOW_WIDGET_POINTER_DRAG_DROP_EVENT',
    'window.addEventListener(FLOW_WIDGET_POINTER_DRAG_DROP_EVENT, onFlowWidgetPointerDragDropCapture, true)',
    'commitFlowWidgetPointerDrop',
    'isFlowWidgetPointerDropDistanceAccepted',
    'readResolvedStoryboardWidgetDropTransform',
    'useProjectedRichMediaShell: true',
    'readStoryboardWidgetDropRect({',
    'resolveWidgetRegistryEntryForDrop(args.widgetRegistryRef.current || [], payload)',
    'resolveWidgetRegistryEntryForDrop(args.widgetRegistryRef.current || [], session)',
    'appendDraftNode: (args: {',
    'args.appendDraftNode({ id: requestedId',
    'pendingOpenWidgetNodeIdRef.current = actualId',
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
  ]
  for (const snippet of widgetDropBridgeSnippets) {
    if (!widgetDropBridgeText.includes(snippet)) {
      throw new Error(`expected ready-to-Run widget drop default snippet: ${snippet}`)
    }
  }
  if (widgetDropBridgeText.includes('if (session.nativeDragStarted) return')) {
    throw new Error('expected widget pointer fallback to materialize native drag releases instead of returning before drop creation')
  }
  const pointerUpStart = widgetDropBridgeText.indexOf('const onPointerUpCapture =')
  const pointerDistanceCheck = widgetDropBridgeText.indexOf('if (!isFlowWidgetPointerDropDistanceAccepted(session, release.clientX, release.clientY))', pointerUpStart)
  const pointerNativeAwaitReturn = widgetDropBridgeText.indexOf('if (session.nativeDragStarted === true) return', pointerUpStart)
  const pointerPostNativeClear = widgetDropBridgeText.indexOf('clearActiveFlowWidgetPointerDragSession(ev.pointerId)', pointerNativeAwaitReturn)
  if (pointerUpStart < 0 || pointerDistanceCheck < 0 || pointerNativeAwaitReturn < pointerDistanceCheck || pointerPostNativeClear < pointerNativeAwaitReturn) {
    throw new Error('expected widget pointer fallback not to clear the active session before native dragend can commit the drop')
  }
  if (!widgetDropBridgeText.includes('if (session.nativeDragStarted === true) return')) {
    throw new Error('expected unresolved native drags to keep the pointer session alive for dragend commit')
  }
  if (!widgetSharedText.includes('export function readProjectedRichMediaShellTransform')
    || !widgetSharedText.includes('export function readResolvedStoryboardWidgetDropTransform')) {
    throw new Error('expected Storyboard widget drops to share Rich Media shell transform fallback from the shared surface owner')
  }
  if (!widgetSurfaceText.includes('readResolvedStoryboardWidgetDropTransform')
    || !widgetSurfaceText.includes('resolveFlowWidgetDragEventReleaseClientPoint(ev.nativeEvent)')
    || !widgetSurfaceText.includes('const pos = readSurfaceDrop(release.clientX, release.clientY)')) {
    throw new Error('expected Storyboard surface native widget drops to reuse the shared drop transform path')
  }

  const defaultHelperSnippets = [
    [storyboardWidgetConfigText, "FLOW_TEXT_GENERATION_SEED_PROMPT_DEFAULT = 'Generate a text response for the active request.'", 'text seed default'],
    [storyboardWidgetConfigText, 'export function getFlowTextGenerationSeedPrompt', 'text seed helper'],
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
