import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildStaticRichMediaPanelOverlayState,
  listDisplayRichMediaOverlayNodes,
  normalizeRichMediaPanelDensity,
  normalizeRichMediaPanelTab,
  readRichMediaDisplayMode,
  resolveRichMediaAspectSelection,
  resolveRichMediaPanelInteractive,
  resolveRichMediaPanelSelectedTab,
  resolveToggledRichMediaAspectSize,
} from '@/lib/render/richMediaSsot'

export function testRichMediaSsotConsistencyRegression() {
  if (readRichMediaDisplayMode(false) !== 'circle-only') {
    throw new Error('expected Rich Media display mode SSOT to map false to circle-only')
  }
  if (readRichMediaDisplayMode(true) !== 'panel-only') {
    throw new Error('expected Rich Media display mode SSOT to map true to panel-only')
  }
  if (
    readRichMediaDisplayMode({
      renderMediaAsNodes: false,
      canvas2dRenderer: 'flowEditor',
      frontmatterModeEnabled: true,
      documentSemanticMode: 'document',
    }) !== 'panel-only'
  ) {
    throw new Error('expected frontmatter Flow Editor document mode to force Rich Media display mode to panel-only')
  }
  if (normalizeRichMediaPanelDensity('compact') !== 'compact') {
    throw new Error('expected Rich Media panel density SSOT to preserve compact mode')
  }
  if (normalizeRichMediaPanelDensity('anything-else') !== 'default') {
    throw new Error('expected Rich Media panel density SSOT to clamp unknown values to default')
  }
  if (normalizeRichMediaPanelTab('VIDEO') !== 'video') {
    throw new Error('expected Rich Media panel tab SSOT to normalize case-insensitive tab values')
  }
  if (
    resolveRichMediaPanelSelectedTab({
      activeTab: 'auto',
      hasText: true,
      hasImage: false,
      hasVideo: false,
      hasPoi: false,
      renderKind: 'iframe',
      hasRenderableUrl: false,
      hasInlineSrcDoc: false,
    }) !== 'text'
  ) {
    throw new Error('expected Rich Media panel selected-tab SSOT to fall back to text for auto iframe panels without concrete media payloads')
  }
  if (resolveRichMediaAspectSelection({ width: 320, height: 180 }) !== '16:9') {
    throw new Error('expected Rich Media aspect SSOT to detect 16:9 layouts')
  }
  if (resolveRichMediaAspectSelection({ width: 180, height: 320 }) !== '9:16') {
    throw new Error('expected Rich Media aspect SSOT to detect 9:16 layouts')
  }
  const toggledAspect = resolveToggledRichMediaAspectSize({
    width: 320,
    height: 180,
    selected: '16:9',
  })
  if (toggledAspect.selected !== '9:16' || toggledAspect.width >= toggledAspect.height) {
    throw new Error('expected Rich Media aspect toggle SSOT to flip 16:9 panels into a taller 9:16 layout')
  }
  if (resolveRichMediaPanelInteractive({ nodeInteractive: false, renderMediaAsNodes: false, infiniteCanvasInteractionMode: 'interactive' }) !== true) {
    throw new Error('expected interactive canvas mode to force Rich Media interactivity across renderers')
  }
  if (resolveRichMediaPanelInteractive({ nodeInteractive: true, renderMediaAsNodes: true, infiniteCanvasInteractionMode: 'static' }) !== true) {
    throw new Error('expected panel-only Rich Media mode to preserve interactive media nodes')
  }
  if (resolveRichMediaPanelInteractive({ nodeInteractive: true, renderMediaAsNodes: false, infiniteCanvasInteractionMode: 'static' }) !== false) {
    throw new Error('expected circle-only Rich Media mode to disable overlay interaction')
  }
  if (
    resolveRichMediaPanelInteractive({
      nodeInteractive: true,
      renderMediaAsNodes: false,
      infiniteCanvasInteractionMode: 'static',
      canvas2dRenderer: 'flowEditor',
      frontmatterModeEnabled: true,
      documentSemanticMode: 'document',
    }) !== true
  ) {
    throw new Error('expected frontmatter Flow Editor document mode to preserve Rich Media overlay interaction without the manual toggle')
  }
  const staticVideoPanel = buildStaticRichMediaPanelOverlayState({ renderKind: 'video' })
  if (staticVideoPanel.activeTab !== 'video' || staticVideoPanel.hasVideo !== true || staticVideoPanel.isLoading !== false) {
    throw new Error('expected static Rich Media panel builder to derive canonical video state without local ad hoc fields')
  }
  const staticTextPanel = buildStaticRichMediaPanelOverlayState({ activeTab: 'text', text: 'hello' })
  if (staticTextPanel.activeTab !== 'text' || staticTextPanel.hasText !== true || staticTextPanel.loadingLabel !== '') {
    throw new Error('expected static Rich Media panel builder to derive canonical text state with stable defaults')
  }

  const imageNode = {
    id: 'img-1',
    type: 'image',
    properties: { imageUrl: 'https://example.com/demo.png' },
  } as any
  if (listDisplayRichMediaOverlayNodes({ renderMediaAsNodes: false, nodes: [imageNode], poolMax: 24 }).length !== 0) {
    throw new Error('expected Rich Media overlay pool SSOT to disable overlays when display toggle is off')
  }
  if (listDisplayRichMediaOverlayNodes({ renderMediaAsNodes: true, nodes: [imageNode], poolMax: 24 }).length !== 1) {
    throw new Error('expected Rich Media overlay pool SSOT to enable overlays when display toggle is on')
  }
  if (
    listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes: false,
      canvas2dRenderer: 'flowEditor',
      frontmatterModeEnabled: true,
      documentSemanticMode: 'document',
      nodes: [imageNode],
      poolMax: 24,
    }).length !== 1
  ) {
    throw new Error('expected frontmatter Flow Editor document mode to enable the Rich Media overlay pool without the manual toggle')
  }

  const flowCanvasText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx'), 'utf8')
  const flowCanvasGraphStateText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts'), 'utf8')
  const flowCanvasMediaOverlayText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx'), 'utf8')
  const flowEditorCanvasText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx'), 'utf8')
  const flowEditorCanvasSurfaceText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'FlowEditorCanvasSurface.tsx'), 'utf8')
  const flowEditorOverlaySurfaceText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx'), 'utf8')
  const d3HookText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts'), 'utf8')
  const d3LayerText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx'), 'utf8')
  const graphCanvasSceneText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts'), 'utf8')
  const graphCanvasNodesLayerText = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'nodes.ts'), 'utf8')
  const designText = readFileSync(resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx'), 'utf8')
  const designMarkdownPanelGroupsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasMarkdownPanelGroups.ts'), 'utf8')
  const designMediaOverlayText = readFileSync(resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'MediaOverlay.tsx'), 'utf8')
  const staticRichMediaPanelPreviewText = readFileSync(resolve(process.cwd(), 'src', 'components', 'StaticRichMediaPanelPreview.tsx'), 'utf8')
  const markdownDesignOverlayText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'), 'utf8')
  const previewPanelText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'panels', 'views', 'PreviewPanelView.impl.tsx'), 'utf8')
  const threeText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'three', 'ThreeGraph.impl.tsx'), 'utf8')

  if (
    !flowCanvasGraphStateText.includes('listDisplayRichMediaOverlayNodes')
    || !flowCanvasMediaOverlayText.includes('commitRichMediaPanelChange')
    || !flowCanvasMediaOverlayText.includes('resolveRichMediaPanelInteractive')
  ) {
    throw new Error('expected FlowCanvas runtime modules to reuse upstream Rich Media SSOT helpers for overlay enablement, writeback, and interactivity')
  }
  if (!flowCanvasGraphStateText.includes('const flowEditorRichMediaPanelOverlayExcludeNodeIdSet = React.useMemo(() => {')) {
    throw new Error('expected FlowCanvas to derive a Flow Editor Rich Media overlay exclusion set before mounting overlay panels')
  }
  if (!flowCanvasGraphStateText.includes("cacheScope: 'flow-canvas-scene-graph'") || !flowCanvasGraphStateText.includes('getCachedGraphLookup({')) {
    throw new Error('expected FlowCanvas graph state to reuse the shared scene-graph lookup helper instead of rebuilding local node maps for Rich Media overlay decisions')
  }
  if (!flowCanvasGraphStateText.includes('buildRichMediaPanelOverlayExcludeNodeIdSet({')) {
    throw new Error('expected FlowCanvas to reuse the upstream Rich Media panel overlay exclusion helper')
  }
  if (!flowCanvasGraphStateText.includes('excludeRichMediaOverlayNodeIds?: string[]')) {
    throw new Error('expected FlowCanvas to accept explicit Rich Media overlay exclusion ids from Flow Editor')
  }
  if (!flowCanvasGraphStateText.includes('excludeNodeIdSet: flowEditorRichMediaPanelOverlayExcludeNodeIdSet')) {
    throw new Error('expected FlowCanvas overlay pool to exclude Flow Editor Rich Media panel nodes from duplicate overlay panels')
  }
  if (!flowCanvasGraphStateText.includes('buildRichMediaConnectedValueTargetNodeIdSet({')) {
    throw new Error('expected FlowCanvas graph state to reuse the upstream Rich Media connected-value target helper')
  }
  if (!flowCanvasGraphStateText.includes('isRichMediaConnectedValueTargetNode({ node, includeMediaSpecNodes: true })')) {
    throw new Error('expected FlowCanvas sticky Rich Media overlay validation to reuse the upstream node-level eligibility helper')
  }
  if (!flowCanvasGraphStateText.includes('nodeById: sceneGraphNodeById || undefined')) {
    throw new Error('expected FlowCanvas overlay pool to pass the shared scene-graph lookup through the Rich Media SSOT wrapper')
  }
  if (!flowCanvasGraphStateText.includes('...(Array.isArray(excludeRichMediaOverlayNodeIds) ? excludeRichMediaOverlayNodeIds : [])')) {
    throw new Error('expected FlowCanvas duplicate exclusion to include Flow Editor overlay node ids')
  }
  if (!flowCanvasGraphStateText.includes('const excludeAllRichMediaPanelNodes = !flowEditorFrontmatterInteractionMode')) {
    throw new Error('expected FlowCanvas Flow Editor exclusion to relax blanket Rich Media panel suppression in frontmatter document mode')
  }
  if (!flowCanvasGraphStateText.includes('excludeAllRichMediaPanelNodes,')) {
    throw new Error('expected FlowCanvas Flow Editor exclusion to pass blanket panel suppression through the shared Rich Media exclusion helper')
  }
  if (
    !flowEditorCanvasText.includes('overlayEditorNodeIds')
    || !flowEditorCanvasSurfaceText.includes('excludeRichMediaOverlayNodeIds={props.overlayEditorNodeIds}')
  ) {
    throw new Error('expected FlowEditorCanvas runtime to pass overlay editor node ids through the surface into FlowCanvas Rich Media duplicate exclusion')
  }
  if (!flowEditorOverlaySurfaceText.includes('buildRichMediaConnectedValueTargetNodeIdSet({')) {
    throw new Error('expected FlowEditor overlay surface to reuse the upstream Rich Media connected-value target helper')
  }
  if (!flowCanvasGraphStateText.includes('const useStickyOverlayPool = !flowEditorOverlayInteractionMode && !flowEditorFrontmatterInteractionMode')) {
    throw new Error('expected FlowCanvas Rich Media overlay pool to disable sticky carryover in Flow Editor/frontmatter collective modes')
  }
  if (!flowCanvasGraphStateText.includes('if (!useStickyOverlayPool) {')) {
    throw new Error('expected FlowCanvas Rich Media overlay pool to follow the live suggested overlay set directly in Flow Editor/frontmatter collective modes')
  }
  if (!d3HookText.includes('listDisplayRichMediaOverlayNodes')) {
    throw new Error('expected D3 rich media overlay hook to reuse upstream Rich Media overlay enablement SSOT')
  }
  if (!d3HookText.includes("cacheScope: 'graph-canvas-root-rich-media-overlays-scene-graph'") || !d3HookText.includes('getCachedGraphLookup({')) {
    throw new Error('expected D3 rich media overlay hook to reuse the shared scene-graph lookup helper instead of rebuilding local node maps')
  }
  if (!d3HookText.includes('nodeById: sceneGraphNodeById || undefined')) {
    throw new Error('expected D3 rich media overlay hook to pass the shared scene-graph lookup through the Rich Media SSOT wrapper')
  }
  if (!d3LayerText.includes('commitRichMediaPanelChange') || !d3LayerText.includes('resolveRichMediaPanelInteractive')) {
    throw new Error('expected D3 rich media overlay layer to reuse upstream Rich Media panel writeback and interactivity SSOT')
  }
  if (!graphCanvasSceneText.includes('preferDomMediaOverlays: true')) {
    throw new Error('expected GraphCanvas scene to force DOM Rich Media overlays as the sole active panel renderer')
  }
  if (graphCanvasNodesLayerText.includes('media-node-panel') || graphCanvasNodesLayerText.includes('data-role\', \'media-panel-media\'')) {
    throw new Error('expected GraphCanvas nodes layer to remove the legacy in-SVG Rich Media panel renderer after DOM overlay consolidation')
  }
  if (!designText.includes('useDesignCanvasMarkdownPanelGroups') || !designMarkdownPanelGroupsText.includes('listDisplayRichMediaOverlayNodes')) {
    throw new Error('expected Design canvas runtime to reuse upstream Rich Media overlay enablement SSOT through its markdown panel group helper')
  }
  if (!designMediaOverlayText.includes('panel={node.panel}') || !designMediaOverlayText.includes('commitRichMediaPanelChange')) {
    throw new Error('expected Design canvas media overlays to reuse canonical Rich Media panel state and writeback helpers')
  }
  if (!staticRichMediaPanelPreviewText.includes('buildStaticRichMediaPanelOverlayState({ renderKind: kind })')) {
    throw new Error('expected static Rich Media panel preview to derive canonical panel state through the shared static builder')
  }
  if (
    !previewPanelText.includes('buildStaticRichMediaPanelOverlayState({ renderKind: activeMedia.kind })')
    || !previewPanelText.includes('panel={previewPanelState || undefined}')
    || !previewPanelText.includes('commitRichMediaPanelChange')
  ) {
    throw new Error('expected Preview panel rich media mounts to reuse canonical Rich Media panel state and writeback helpers')
  }
  if (!previewPanelText.includes('const widgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)')) {
    throw new Error('expected PreviewPanelView graph media path to reuse the effective widget registry SSOT')
  }
  if (previewPanelText.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected PreviewPanelView to avoid rebuilding a duplicate merged widget registry locally')
  }
  if (!previewPanelText.includes('registry: widgetRegistry,')) {
    throw new Error('expected PreviewPanelView connected-value computation to consume the effective widget registry directly')
  }
  if (!markdownDesignOverlayText.includes("buildStaticRichMediaPanelOverlayState({ activeTab: 'text', text: snippet })")) {
    throw new Error('expected markdown design overlay text previews to reuse the shared static Rich Media panel builder')
  }
  if (!threeText.includes('listDisplayRichMediaOverlayNodes') || !threeText.includes('resolveRichMediaPanelInteractive')) {
    throw new Error('expected 3D rich media overlays to reuse upstream Rich Media SSOT helpers')
  }
  if (!threeText.includes('panel={n.panel}') || !threeText.includes('commitRichMediaPanelChange')) {
    throw new Error('expected 3D rich media overlays to reuse canonical Rich Media panel state and writeback helpers')
  }
}
