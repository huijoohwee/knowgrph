import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildRichMediaPanelOverlayState,
  buildStaticRichMediaPanelOverlayState,
  listDisplayRichMediaOverlayNodes,
  normalizeRichMediaPanelDensity,
  normalizeRichMediaPanelTab,
  readRichMediaDisplayMode,
  resolveRichMediaSurfaceMode,
  resolveRichMediaAspectSelection,
  resolveRichMediaPanelInteractive,
  resolveRichMediaPanelSelectedTab,
  resolveToggledRichMediaAspectSize,
} from '@/lib/render/richMediaSsot'
import { buildCanvasViewOptions, getCanvasViewRendererOptions } from '@/components/toolbar/canvasViewMenu'

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
  if (resolveRichMediaSurfaceMode({ renderMediaAsNodes: false, canvasRenderMode: '3d', canvas3dMode: 'xr' }) !== 'xr') {
    throw new Error('expected Rich Media surface resolver to preserve XR surface mode')
  }
  if (resolveRichMediaSurfaceMode({ renderMediaAsNodes: false, canvasRenderMode: '3d', canvas3dMode: 'voxel' }) !== 'voxel') {
    throw new Error('expected Rich Media surface resolver to preserve Voxel surface mode')
  }
  if (resolveRichMediaSurfaceMode({ renderMediaAsNodes: false, geospatialEnabled: true }) !== 'geospatial') {
    throw new Error('expected Rich Media surface resolver to preserve Geospatial surface mode')
  }
  if (readRichMediaDisplayMode({ renderMediaAsNodes: true, geospatialEnabled: true }) !== 'panel-only') {
    throw new Error('expected Rich Media display mode SSOT to allow panel mode on Geospatial surface when enabled')
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
  if (normalizeRichMediaPanelTab('AUDIO') !== 'audio') {
    throw new Error('expected Rich Media panel tab SSOT to normalize audio tab values')
  }
  if (
    resolveRichMediaPanelSelectedTab({
      activeTab: 'auto',
      hasText: true,
      hasImage: false,
      hasVideo: false,
      hasAudio: false,
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
  const staticAudioPanel = buildStaticRichMediaPanelOverlayState({ renderKind: 'audio' })
  if (staticAudioPanel.activeTab !== 'audio' || staticAudioPanel.hasAudio !== true || staticAudioPanel.isLoading !== false) {
    throw new Error('expected static Rich Media panel builder to derive canonical audio state without local ad hoc fields')
  }
  const staticTextPanel = buildStaticRichMediaPanelOverlayState({ activeTab: 'text', text: 'hello' })
  if (staticTextPanel.activeTab !== 'text' || staticTextPanel.hasText !== true || staticTextPanel.loadingLabel !== '') {
    throw new Error('expected static Rich Media panel builder to derive canonical text state with stable defaults')
  }
  const idlePanelNode = {
    id: 'panel-idle',
    type: 'RichMediaPanel',
    properties: {
      outputLoading: true,
      outputLoadingKind: 'text',
    },
  } as any
  const idlePanel = buildRichMediaPanelOverlayState({ node: idlePanelNode })
  if (!idlePanel || idlePanel.isLoading !== false) {
    throw new Error('expected Rich Media panel loading SSOT to keep initialization-only loading flags out of the animated loading state')
  }
  const runningPanelNode = {
    id: 'panel-running',
    type: 'RichMediaPanel',
    properties: {
      outputLoading: true,
      outputLoadingKind: 'text',
      lastRunAt: '2026-05-02T00:00:00.000Z',
    },
  } as any
  const runningPanel = buildRichMediaPanelOverlayState({ node: runningPanelNode })
  if (!runningPanel || runningPanel.isLoading !== true) {
    throw new Error('expected Rich Media panel loading SSOT to show animated loading only for run-scoped output loading states')
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
      renderMediaAsNodes: true,
      canvasRenderMode: '3d',
      canvas3dMode: 'xr',
      nodes: [imageNode],
      poolMax: 24,
    }).length !== 1
  ) {
    throw new Error('expected Rich Media overlay pool SSOT to enable XR surface overlays through the shared helper')
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
  const geospatialMenu = buildCanvasViewOptions(
    {
      canvas2dRenderer: 'd3',
      canvas3dMode: '3d',
      canvasRenderMode: '2d',
      documentSemanticMode: 'document',
      frontmatterModeEnabled: false,
      multiDimTableModeEnabled: false,
      renderMediaAsNodes: true,
      timelineEnabled: true,
      bottomSurfaceCollapsed: true,
      bottomSurfaceTab: 'stats',
      geospatialEnabled: true,
      layoutMode: 'block',
      schema: { layout: { mode: 'block' }, behavior: {}, nodeStyles: {}, edgeStyles: {}, rules: [] } as any,
      frontmatterOnlyAllowed: false,
      isD3Like2dLayoutToggle: true,
    },
    getCanvasViewRendererOptions(),
  )
  const richMediaControl = geospatialMenu
    .find(option => option.id === 'control:menu')
    ?.children
    ?.find(option => option.id === 'control:richMedia')
  if (!richMediaControl || richMediaControl.disabled === true || richMediaControl.isActive !== true) {
    throw new Error('expected Canvas View Display Controls to reuse Rich Media SSOT and keep Rich Media active/selectable on Geospatial surface')
  }

  const flowCanvasText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx'), 'utf8')
  const flowCanvasGraphStateText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts'), 'utf8')
  const flowCanvasMediaOverlayText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx'), 'utf8')
  const flowEditorCanvasText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx'), 'utf8')
  const flowEditorFormText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx'), 'utf8')
  const flowEditorPanelText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx'), 'utf8')
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
  const sharedWebpageSurfaceText = readFileSync(resolve(process.cwd(), 'src', 'components', 'SharedWebpageSurface.tsx'), 'utf8')
  const sharedWebpageSnapshotSurfaceText = readFileSync(resolve(process.cwd(), 'src', 'components', 'SharedWebpageSnapshotSurface.tsx'), 'utf8')
  const webpageSnapshotPreviewText = readFileSync(resolve(process.cwd(), 'src', 'components', 'WebpageSnapshotPreview.tsx'), 'utf8')
  const designWebpageWireframeText = readFileSync(resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'webpageWireframe.tsx'), 'utf8')
  const webpageLayoutPresetsText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'websites', 'webpageLayoutPresets.ts'), 'utf8')
  const sharedWebpageSnapshotLogicText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'websites', 'webpageSnapshotShared.ts'), 'utf8')
  const asyncGuardsText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'async', 'asyncGuards.ts'), 'utf8')
  const asyncEffectRunnerText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'async', 'asyncEffectRunner.ts'), 'utf8')
  const responsiveElementClassesText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'ui', 'responsiveElementClasses.ts'), 'utf8')
  const responsiveToolbarCssText = readFileSync(resolve(process.cwd(), 'src', 'styles', 'responsive-toolbar.css'), 'utf8')
  const progressTickerText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'progress', 'progressTicker.ts'), 'utf8')
  const markdownWorkspaceStatusTransitionsText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceStatusTransitions.ts'), 'utf8')
  const markdownWorkspaceRuntimeStatusText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceRuntimeStatus.ts'), 'utf8')
  const markdownWorkspaceRuntimeImplText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx'), 'utf8')
  const markdownWorkspaceDerivedViewsText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceDerivedViews.tsx'), 'utf8')
  const markdownWorkspaceSaveText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceSave.ts'), 'utf8')
  const markdownWorkspaceIndexingText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx'), 'utf8')
  const markdownWorkspaceInteractionsText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceInteractions.ts'), 'utf8')
  const markdownWorkspaceExplorerStateText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceExplorerState.tsx'), 'utf8')
  const markdownWorkspaceViewShellText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceViewShell.tsx'), 'utf8')
  const workspaceUrlContentText = readFileSync(resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'workspaceImport', 'urlContent.ts'), 'utf8')
  const markdownWorkspaceWebpageSurfaceText = readFileSync(resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'presentation', 'MarkdownWorkspaceWebpageSurface.tsx'), 'utf8')
  const richMediaPanelText = readFileSync(resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx'), 'utf8')
  const markdownMediaUiText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-core', 'ui', 'MarkdownMediaUi.impl.tsx'), 'utf8')
  const markdownDesignOverlayText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'), 'utf8')
  const previewPanelText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'panels', 'views', 'PreviewPanelView.impl.tsx'), 'utf8')
  const commandMenuRichMediaInventoryText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'command-menu', 'commandMenuRichMediaInventory.ts'), 'utf8')
  const threeText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'three', 'useThreeRichMediaOverlayController.tsx'), 'utf8')
  const panelFrameText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'ui', 'panelFrame.ts'), 'utf8')

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
  if (!panelFrameText.includes('PANEL_FRAME_EMBEDDED_SURFACE_STYLE') || !panelFrameText.includes("boxShadow: 'none'")) {
    throw new Error('expected panelFrame to own embedded Rich Media full-surface styling')
  }
  for (const surfaceText of [flowEditorFormText, flowEditorPanelText, markdownDesignOverlayText, previewPanelText]) {
    if (surfaceText.includes("style={{ width: '100%', height: '100%', boxShadow: 'none' }}")) throw new Error('expected embedded Rich Media surfaces to reuse PANEL_FRAME_EMBEDDED_SURFACE_STYLE')
  }
  if (!flowCanvasGraphStateText.includes('excludeRichMediaOverlayNodeIds?: string[]')) {
    throw new Error('expected FlowCanvas to accept explicit Rich Media overlay exclusion ids from Flow Editor')
  }
  if (!flowCanvasGraphStateText.includes('excludeNodeIdSet: flowEditorRichMediaPanelOverlayExcludeNodeIdSet')) {
    throw new Error('expected FlowCanvas overlay pool to exclude Flow Editor Rich Media panel nodes from duplicate overlay panels')
  }
  if (!flowCanvasGraphStateText.includes('computeRichMediaOverlayConnectedValuesByNodeId({')) {
    throw new Error('expected FlowCanvas graph state to reuse the upstream Rich Media connected-value derivation helper')
  }
  if (!flowCanvasGraphStateText.includes('isRichMediaConnectedValueTargetNode({ node, includeMediaSpecNodes: true })')) {
    throw new Error('expected FlowCanvas sticky Rich Media overlay validation to reuse the upstream node-level eligibility helper')
  }
  if (!flowCanvasGraphStateText.includes('nodeById: sceneGraphNodeById || undefined')) {
    throw new Error('expected FlowCanvas overlay pool to pass the shared scene-graph lookup through the Rich Media SSOT wrapper')
  }
  if (!flowCanvasGraphStateText.includes("hashScopedStringArraySignature('flow-exclude-rich-media-overlay-node-ids', excludeRichMediaOverlayNodeIds)")) {
    throw new Error('expected FlowCanvas duplicate exclusion ids to be keyed by a semantic signature instead of raw array identity')
  }
  if (!flowCanvasGraphStateText.includes('...excludeRichMediaOverlayNodeIdsSnapshot,')) {
    throw new Error('expected FlowCanvas duplicate exclusion to include Flow Editor overlay node ids via the normalized semantic snapshot')
  }
  if (!flowCanvasGraphStateText.includes('const excludeAllRichMediaPanelNodes = !flowEditorFrontmatterInteractionMode')) {
    throw new Error('expected FlowCanvas Flow Editor exclusion to relax blanket Rich Media panel suppression in frontmatter document mode')
  }
  if (!flowCanvasGraphStateText.includes('excludeAllRichMediaPanelNodes,')) {
    throw new Error('expected FlowCanvas Flow Editor exclusion to pass blanket panel suppression through the shared Rich Media exclusion helper')
  }
  if (!flowEditorCanvasText.includes('flowCanvasGraphDataOverride')) {
    throw new Error('expected FlowEditorCanvas runtime to pass an upstream-filtered graph override into FlowCanvas to prevent overlay seepage')
  }
  if (flowEditorCanvasSurfaceText.includes('excludeRichMediaOverlayNodeIds=')) {
    throw new Error('expected FlowEditorCanvas surface to forbid downstream Rich Media hide/exclude masking props')
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
  const updateNodeHookIndex = d3LayerText.indexOf('const updateNode = useGraphStore(s => s.updateNode)')
  const inactiveReturnIndex = d3LayerText.indexOf('if (!active) return null')
  if (updateNodeHookIndex < 0 || inactiveReturnIndex < 0 || updateNodeHookIndex > inactiveReturnIndex) {
    throw new Error('expected D3 rich media overlay layer to declare all store hooks before any early return to keep hook ordering stable during media-rich imports')
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
  if (!sharedWebpageSurfaceText.includes('export function SharedWebpageSurface(')) {
    throw new Error('expected webpage snapshot/embed rendering to be centralized in one shared surface helper upstream')
  }
  if (!sharedWebpageSnapshotSurfaceText.includes('export function SharedWebpageSnapshotSurface(')) {
    throw new Error('expected webpage snapshot card rendering to be centralized in one shared snapshot surface helper upstream')
  }
  if (!responsiveElementClassesText.includes('UI_RESPONSIVE_WEBPAGE_SNAPSHOT_OVERLAY_BADGE_CLASSNAME') || !responsiveElementClassesText.includes('UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME') || !responsiveToolbarCssText.includes('.kg-webpage-snapshot-overlay-badge') || !sharedWebpageSnapshotSurfaceText.includes('UI_RESPONSIVE_WEBPAGE_SNAPSHOT_OVERLAY_BADGE_CLASSNAME') || !sharedWebpageSnapshotSurfaceText.includes('UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME') || !markdownMediaUiText.includes('UI_RESPONSIVE_WEBPAGE_SNAPSHOT_OVERLAY_BADGE_CLASSNAME') || !markdownMediaUiText.includes('UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME') || [sharedWebpageSnapshotSurfaceText, markdownMediaUiText].some(text => text.includes("maxWidth: 'min(520px, 92%)'") || text.includes('className="absolute inset-0 pointer-events-none"'))) {
    throw new Error('expected webpage snapshot overlay badge width to live in the shared responsive owner instead of inline card-local styles')
  }
  const webpageSnapshotMediaClassIds = [
    'UI_RESPONSIVE_WEBPAGE_SNAPSHOT_PREVIEW_MEDIA_CLASSNAME',
    'UI_RESPONSIVE_WEBPAGE_SNAPSHOT_FAVICON_MEDIA_CLASSNAME',
    'UI_RESPONSIVE_WEBPAGE_SNAPSHOT_HOST_ICON_MEDIA_CLASSNAME',
    'UI_RESPONSIVE_WEBPAGE_SNAPSHOT_MEDIA_BACKDROP_CLASSNAME',
    'UI_RESPONSIVE_WEBPAGE_SNAPSHOT_EMPTY_MEDIA_CLASSNAME',
  ]
  const webpageSnapshotInlineStyleFragments = [
    "objectFit: 'contain'",
    "objectFit: 'cover'",
    "padding: '18%'",
    'linear-gradient(135deg',
    'absolute inset-0 bg-black/5',
  ]
  if (
    !responsiveElementClassesText.includes('UI_RESPONSIVE_FILL_MEDIA_SURFACE_CLASSNAME') ||
    webpageSnapshotMediaClassIds.some(classId => !responsiveElementClassesText.includes(classId) || !sharedWebpageSnapshotSurfaceText.includes(classId)) ||
    !sharedWebpageSnapshotSurfaceText.includes('UI_RESPONSIVE_FILL_MEDIA_SURFACE_CLASSNAME') ||
    !markdownMediaUiText.includes('UI_RESPONSIVE_WEBPAGE_SNAPSHOT_PREVIEW_MEDIA_CLASSNAME') ||
    !responsiveToolbarCssText.includes('.kg-webpage-snapshot-media') ||
    !responsiveToolbarCssText.includes('.kg-webpage-snapshot-media-backdrop') ||
    webpageSnapshotInlineStyleFragments.some(fragment => [sharedWebpageSnapshotSurfaceText, markdownMediaUiText].some(text => text.includes(fragment)))
  ) {
    throw new Error('expected webpage snapshot media fit, padding, opacity, and backdrop styles to live in the shared responsive owner instead of inline card-local styles')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export async function probeWebpageLayoutSnapshot(')) {
    throw new Error('expected webpage layout snapshot probing/parsing to be centralized in one shared upstream helper')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export async function loadWebpageLayoutSnapshotWithCache(')) {
    throw new Error('expected webpage layout snapshot cache/probe/cache-write loading to be centralized in one shared upstream helper')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export function useWebpageLayoutSnapshotLifecycle(')) {
    throw new Error('expected webpage layout snapshot cache/probe lifecycle to be centralized in one shared upstream helper')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export function formatWebpageLayoutExportStatus(') || !sharedWebpageSnapshotLogicText.includes('export function formatWebpageLayoutExportError(')) {
    throw new Error('expected webpage export status and error formatting to be centralized in the shared upstream helper layer')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export function resolveWebpageLayoutExportOutcome(')) {
    throw new Error('expected webpage export outcome resolution to be centralized in the shared upstream helper layer')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export function applyWebpageLayoutExportOutcome(')) {
    throw new Error('expected webpage export outcome application to be centralized in the shared upstream helper layer')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export function emitWebpageLayoutExportWarningToast(')) {
    throw new Error('expected webpage export warning-toast emission to be centralized in the shared upstream helper layer')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export function useWebpageSnapshotSurfaceAssets(')) {
    throw new Error('expected webpage snapshot asset composition to be centralized in one shared upstream helper')
  }
  if (!sharedWebpageSnapshotLogicText.includes('export function isNoiseProneWebpagePreviewHost(') || !sharedWebpageSnapshotLogicText.includes('export function shouldAutoLoadWebpageLayoutSnapshot(')) {
    throw new Error('expected webpage snapshot host suppression and auto-load policy to be centralized in the shared upstream helper layer')
  }
  if (!webpageLayoutPresetsText.includes('export function buildWebpageLayoutCacheKey(')) {
    throw new Error('expected webpage layout cache-key construction to be centralized in one shared upstream preset helper')
  }
  if (!progressTickerText.includes('export function stopProgressTickerSafely(')) {
    throw new Error('expected progress ticker stop/finalize behavior to be centralized in a shared upstream helper')
  }
  if (!progressTickerText.includes('export function createProgressSession(')) {
    throw new Error('expected progress ticker session setup to be centralized in a shared upstream helper')
  }
  if (!progressTickerText.includes('export function createDefaultProgressSession(')) {
    throw new Error('expected default ui progress-session setup to be centralized in a shared upstream helper')
  }
  if (!progressTickerText.includes('export function beginProgressSession(')) {
    throw new Error('expected progress-session kickoff behavior to be centralized in a shared upstream helper')
  }
  if (!progressTickerText.includes('export function finishProgressSession(') || !progressTickerText.includes('export function failProgressSession(')) {
    throw new Error('expected progress-session finish and failure transitions to be centralized in shared upstream helpers')
  }
  if (
    !markdownWorkspaceRuntimeStatusText.includes('export type MarkdownWorkspaceRuntimeStatusBindings =')
    || !markdownWorkspaceRuntimeStatusText.includes('export type MarkdownWorkspaceRuntimeProgressStatusBindings =')
    || !markdownWorkspaceRuntimeStatusText.includes('export type MarkdownWorkspaceRuntimeInteractionStatusBindings =')
    || !markdownWorkspaceRuntimeStatusText.includes('export function buildMarkdownWorkspaceRuntimeStatusBindings(')
  ) {
    throw new Error('expected markdown workspace runtime status binding types and builder to be centralized in a shared upstream helper')
  }
  if (
    !markdownWorkspaceStatusTransitionsText.includes('export function applyMarkdownWorkspaceSuccessStatus(')
    || !markdownWorkspaceStatusTransitionsText.includes('export function applyMarkdownWorkspaceErrorStatus(')
    || !markdownWorkspaceStatusTransitionsText.includes('export function applyMarkdownWorkspaceInfoStatus(')
    || !markdownWorkspaceStatusTransitionsText.includes('export function buildMarkdownWorkspaceStatusErrorMessage(')
  ) {
    throw new Error('expected markdown workspace status success/error/info transitions to be centralized in a shared runtime helper')
  }
  if (!asyncGuardsText.includes('export function abortControllerSafely(') || !asyncGuardsText.includes('export function isAsyncRequestStale(')) {
    throw new Error('expected async abort and stale-request guard behavior to be centralized in a shared upstream helper')
  }
  if (!asyncEffectRunnerText.includes('export function runAsyncEffect(')) {
    throw new Error('expected async effect orchestration to be centralized in a shared upstream runner helper')
  }
  if (!markdownWorkspaceDerivedViewsText.includes('createDefaultProgressSession')) {
    throw new Error('expected markdown workspace derived-view loaders to reuse the shared default ui progress session helper')
  }
  if (!markdownWorkspaceDerivedViewsText.includes('beginProgressSession')) {
    throw new Error('expected markdown workspace derived-view loaders to reuse the shared progress-session kickoff helper')
  }
  if (!markdownWorkspaceDerivedViewsText.includes('finishProgressSession') || !markdownWorkspaceDerivedViewsText.includes('failProgressSession')) {
    throw new Error('expected markdown workspace derived-view loaders to reuse the shared progress-session finish and failure helpers')
  }
  if (
    !markdownWorkspaceDerivedViewsText.includes('createDerivedViewStatusAdapter(')
    || !markdownWorkspaceDerivedViewsText.includes('applyMarkdownWorkspaceSuccessStatus')
    || !markdownWorkspaceDerivedViewsText.includes('applyMarkdownWorkspaceErrorStatus')
    || !markdownWorkspaceDerivedViewsText.includes('reportError:')
  ) {
    throw new Error('expected markdown workspace derived-view loaders to bind shared status-transition helpers through a file-local adapter')
  }
  if (markdownWorkspaceDerivedViewsText.includes('setErrorLabel')) {
    throw new Error('expected markdown workspace derived-view status adapter to stop keeping a local raw error passthrough after shared status-transition widening')
  }
  if (!markdownWorkspaceSaveText.includes('applyMarkdownWorkspaceSuccessStatus') || !markdownWorkspaceSaveText.includes('applyMarkdownWorkspaceErrorStatus')) {
    throw new Error('expected markdown workspace save flows to reuse the shared markdown workspace status-transition helpers')
  }
  if (!markdownWorkspaceIndexingText.includes('applyMarkdownWorkspaceSuccessStatus') || !markdownWorkspaceIndexingText.includes('applyMarkdownWorkspaceErrorStatus')) {
    throw new Error('expected markdown workspace indexing flows to reuse the shared markdown workspace status-transition helpers')
  }
  if (!markdownWorkspaceInteractionsText.includes('applyMarkdownWorkspaceErrorStatus') || !markdownWorkspaceInteractionsText.includes('applyMarkdownWorkspaceInfoStatus')) {
    throw new Error('expected markdown workspace interaction flows to reuse the shared markdown workspace error/info transition helpers')
  }
  if (!markdownWorkspaceExplorerStateText.includes('applyMarkdownWorkspaceErrorStatus') || !markdownWorkspaceExplorerStateText.includes('applyMarkdownWorkspaceInfoStatus')) {
    throw new Error('expected markdown workspace explorer refresh flows to reuse the shared markdown workspace error/info transition helpers')
  }
  if (!markdownWorkspaceViewShellText.includes('applyMarkdownWorkspaceSuccessStatus')) {
    throw new Error('expected markdown workspace view-shell success flows to reuse the shared markdown workspace success-transition helper')
  }
  if (
    !markdownWorkspaceRuntimeImplText.includes('buildMarkdownWorkspaceRuntimeStatusBindings(')
    || !markdownWorkspaceRuntimeImplText.includes('runtimeProgressStatusBindings')
    || !markdownWorkspaceRuntimeImplText.includes('runtimeInteractionStatusBindings')
  ) {
    throw new Error('expected markdown workspace runtime impl to bind shared status setters once and reuse those bindings across downstream hooks')
  }
  if (!workspaceUrlContentText.includes('createProgressSession')) {
    throw new Error('expected markdown workspace URL import loaders to reuse the shared progress session helper')
  }
  if (!markdownWorkspaceDerivedViewsText.includes('runAsyncEffect')) {
    throw new Error('expected markdown workspace derived-view loaders to reuse the shared async effect runner')
  }
  if (!webpageLayoutPresetsText.includes('export function getUiWebpageSnapshotPreset(') || !webpageLayoutPresetsText.includes('export function getMarkdownWebpageSnapshotPreset(') || !webpageLayoutPresetsText.includes('export function getDesignWebpageWireframePreset(')) {
    throw new Error('expected webpage layout probe presets for ui, markdown, and design callers to be centralized upstream')
  }
  if (!sharedWebpageSurfaceText.includes("renderMode: 'snapshot' | 'iframe'")) {
    throw new Error('expected shared webpage surface helper to normalize snapshot and iframe rendering modes')
  }
  if (!webpageSnapshotPreviewText.includes("import { SharedWebpageSnapshotSurface } from '@/components/SharedWebpageSnapshotSurface'")) {
    throw new Error('expected WebpageSnapshotPreview to reuse the shared webpage snapshot surface helper')
  }
  if (!webpageSnapshotPreviewText.includes('useWebpageLayoutSnapshotLifecycle') || !webpageSnapshotPreviewText.includes('useWebpageSnapshotSurfaceAssets')) {
    throw new Error('expected WebpageSnapshotPreview to reuse shared webpage snapshot lifecycle and asset helpers')
  }
  if (!webpageSnapshotPreviewText.includes('allowNodeJsUserAgent: true') || !webpageSnapshotPreviewText.includes('requireProbeReady: true')) {
    throw new Error('expected WebpageSnapshotPreview to configure the shared snapshot lifecycle helper for deferred UI probing')
  }
  if (!webpageSnapshotPreviewText.includes('getUiWebpageSnapshotPreset') || !webpageSnapshotPreviewText.includes('buildWebpageLayoutCacheKey(layoutPreset)')) {
    throw new Error('expected WebpageSnapshotPreview to reuse the shared ui webpage layout preset and cache-key builder')
  }
  if (!markdownWorkspaceWebpageSurfaceText.includes("import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'")) {
    throw new Error('expected markdown workspace webpage surfaces to reuse the shared webpage surface helper')
  }
  if (markdownWorkspaceWebpageSurfaceText.includes("import WebpageSnapshotPreview from '@/components/WebpageSnapshotPreview'")) {
    throw new Error('expected markdown workspace webpage surfaces to stop rendering snapshot previews directly after shared-surface extraction')
  }
  if (!richMediaPanelText.includes("import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'")) {
    throw new Error('expected RichMediaPanel iframe/webpage branches to reuse the shared webpage surface helper')
  }
  if (richMediaPanelText.includes("import WebpageSnapshotPreview from '@/components/WebpageSnapshotPreview'")) {
    throw new Error('expected RichMediaPanel to stop importing snapshot preview directly after shared-surface extraction')
  }
  if (!markdownMediaUiText.includes("import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'")) {
    throw new Error('expected markdown media iframe rendering to reuse the shared webpage surface helper')
  }
  if (!markdownMediaUiText.includes("import { SharedWebpageSnapshotSurface } from '@/components/SharedWebpageSnapshotSurface'")) {
    throw new Error('expected markdown media webpage snapshot rendering to reuse the shared snapshot surface helper')
  }
  if (!markdownMediaUiText.includes('useWebpageLayoutSnapshotLifecycle') || !markdownMediaUiText.includes('useWebpageSnapshotSurfaceAssets')) {
    throw new Error('expected markdown media webpage snapshot rendering to reuse the shared webpage snapshot lifecycle and asset helpers')
  }
  if (!markdownMediaUiText.includes('isNoiseProneWebpagePreviewHost') || !markdownMediaUiText.includes('skipSnapshot = preferEmbedEffective || isNoiseProneWebpagePreviewHost(normalizedUrl)')) {
    throw new Error('expected markdown media webpage snapshot rendering to gate the shared lifecycle helper through shared host suppression and embed policy')
  }
  if (!markdownMediaUiText.includes('getMarkdownWebpageSnapshotPreset') || !markdownMediaUiText.includes('buildWebpageLayoutCacheKey(layoutPreset)')) {
    throw new Error('expected markdown media webpage snapshot rendering to reuse the shared markdown webpage layout preset and cache-key builder')
  }
  if (!markdownMediaUiText.includes('<SharedWebpageSurface')) {
    throw new Error('expected markdown media iframe rendering to mount the shared webpage surface helper')
  }
  if (!markdownMediaUiText.includes('<SharedWebpageSnapshotSurface')) {
    throw new Error('expected markdown media webpage snapshot rendering to mount the shared snapshot surface helper')
  }
  if (!designWebpageWireframeText.includes("from '@/lib/websites/webpageSnapshotShared'") || !designWebpageWireframeText.includes('loadWebpageLayoutSnapshotWithCache')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared webpage snapshot cached loader helper')
  }
  if (!designWebpageWireframeText.includes('formatWebpageLayoutExportStatus')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse shared webpage export status formatting helpers')
  }
  if (!designWebpageWireframeText.includes('resolveWebpageLayoutExportOutcome')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared webpage export outcome resolver')
  }
  if (!designWebpageWireframeText.includes('applyWebpageLayoutExportOutcome')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared webpage export outcome applier')
  }
  if (!designWebpageWireframeText.includes('emitWebpageLayoutExportWarningToast')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared webpage export warning-toast helper')
  }
  if (!designWebpageWireframeText.includes('createDefaultProgressSession')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared default ui progress session helper')
  }
  if (!designWebpageWireframeText.includes('runAsyncEffect')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared async effect runner')
  }
  if (!sharedWebpageSnapshotLogicText.includes('runAsyncEffect')) {
    throw new Error('expected shared webpage snapshot lifecycle logic to reuse the shared async effect runner')
  }
  const webpageDomExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'websites', 'webpageDomExport.ts'), 'utf8')
  if (!webpageDomExportText.includes("import { isNoiseProneWebpagePreviewHost } from '@/lib/websites/webpageSnapshotShared'")) {
    throw new Error('expected webpage DOM export to reuse the shared noise-prone-host helper instead of duplicating host suppression logic')
  }
  if (!designWebpageWireframeText.includes('getDesignWebpageWireframePreset') || !designWebpageWireframeText.includes('buildWebpageLayoutCacheKey(layoutPreset, { epoch })')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared design webpage layout preset and cache-key builder')
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
  if (!previewPanelText.includes('useCommandMenuRichMediaInventory()')) {
    throw new Error('expected PreviewPanelView to consume the shared Command Menu rich-media inventory instead of owning a duplicate media list')
  }
  if (!commandMenuRichMediaInventoryText.includes('const widgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)')) {
    throw new Error('expected Command Menu rich-media inventory to reuse the effective widget registry SSOT')
  }
  if (!commandMenuRichMediaInventoryText.includes("cacheScope: 'command-menu-rich-media'") || !commandMenuRichMediaInventoryText.includes('getCachedGraphLookup({')) {
    throw new Error('expected Command Menu rich-media inventory to reuse the shared graph lookup helper instead of rebuilding a local node map')
  }
  if (!commandMenuRichMediaInventoryText.includes('nodeById: graphLookup?.nodeById || undefined')) {
    throw new Error('expected Command Menu rich-media inventory to pass the shared graph lookup into Rich Media overlay derivation')
  }
  if (previewPanelText.includes('const effectiveNodeById = new Map(') || commandMenuRichMediaInventoryText.includes('const effectiveNodeById = new Map(')) {
    throw new Error('expected rich-media inventory paths to stop rebuilding a duplicate effective node-id map locally')
  }
  if (previewPanelText.includes('buildDataflowWidgetRegistry') || commandMenuRichMediaInventoryText.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected rich-media inventory paths to avoid rebuilding a duplicate merged widget registry locally')
  }
  if (!commandMenuRichMediaInventoryText.includes('registry: widgetRegistry,')) {
    throw new Error('expected Command Menu rich-media inventory connected-value computation to consume the effective widget registry directly')
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
