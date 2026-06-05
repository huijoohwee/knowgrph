import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function test2dRendererPipelineUsesSharedSurfaceHelpers() {
  const root = resolve(process.cwd(), 'src')
  const renderConfigText = readFileSync(resolve(root, 'lib', 'config.render.ts'), 'utf8')
  const canvasViewportText = readFileSync(resolve(root, 'components', 'CanvasViewport.tsx'), 'utf8')
  const dashboardCanvasText = readFileSync(resolve(root, 'components', 'DashboardCanvas', 'index.tsx'), 'utf8')
  const dashboardModelText = readFileSync(resolve(root, 'components', 'DashboardCanvas', 'dashboardModel.ts'), 'utf8')
  const rendererSelectText = readFileSync(resolve(root, 'components', 'toolbar', 'Canvas2dRendererSelect.tsx'), 'utf8')
  const canvasViewMenuText = readFileSync(resolve(root, 'components', 'toolbar', 'canvasViewMenu.ts'), 'utf8')
  const animaticTimelineModelText = readFileSync(resolve(root, 'components', 'AnimaticCanvas', 'useAnimaticTimelineModel.ts'), 'utf8')
  const responsiveToolbarCssText = readFileSync(resolve(root, 'styles', 'responsive-toolbar.css'), 'utf8')
  const toolbarRendererViewText = readFileSync(resolve(root, 'features', 'toolbar', 'ToolbarToolMenuRendererView.tsx'), 'utf8')
  const rendererGraphTopologySummaryText = readFileSync(resolve(root, 'features', 'toolbar', 'ui', 'RendererGraphTopologySummary.tsx'), 'utf8')
  const threeControlsText = readFileSync(resolve(root, 'features', 'three', 'Controls.tsx'), 'utf8')
  const minimapText = readFileSync(resolve(root, 'features', 'minimap', 'Minimap.tsx'), 'utf8')
  const minimapFlowEditorOverlayProjectionText = readFileSync(resolve(root, 'features', 'minimap', 'flowEditorOverlayProjection.ts'), 'utf8')
  const canvasSyncRuntimeText = readFileSync(resolve(root, 'features', 'canvas', 'CanvasSyncRuntime.tsx'), 'utf8')
  const canvasPreviewSyncInboundText = readFileSync(resolve(root, 'features', 'canvas', 'canvasPreviewSyncInbound.ts'), 'utf8')
  const toolbarToolMenuText = readFileSync(resolve(root, 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx'), 'utf8')
  const uiCopyText = readFileSync(resolve(root, 'lib', 'config-copy', 'uiCopy.ts'), 'utf8')
  const rendererRegistryText = readFileSync(resolve(root, 'lib', 'renderer', 'canvas2dRendererRegistry.ts'), 'utf8')
  const gitGraphCanvasText = readFileSync(resolve(root, 'components', 'MermaidGitGraphCanvas.tsx'), 'utf8')
  const gitGraphFloatingPanelText = readFileSync(resolve(root, 'features', 'gitgraph', 'GitGraphFloatingPanelView.tsx'), 'utf8')
  const gitGraphDocumentHookText = readFileSync(resolve(root, 'features', 'gitgraph', 'useMermaidGitGraphDocument.ts'), 'utf8')
  const svgSurfaceZoomRuntimeText = readFileSync(resolve(root, 'components', 'GraphCanvas', 'hooks', 'useSvgSurfaceZoomRuntime.ts'), 'utf8')

  if (!renderConfigText.includes('export const getCanvas2dSurfaceId')) {
    throw new Error('expected shared renderer surface helper in config.render')
  }
  if (!renderConfigText.includes('export const supportsCanvas2dMinimap')) {
    throw new Error('expected shared minimap support helper in config.render')
  }
  if (!renderConfigText.includes('export const isCanvas2dRendererId')) {
    throw new Error('expected shared 2D renderer id validator in config.render')
  }
  if (!renderConfigText.includes('export const CANVAS_2D_RENDERER_ORDER')) {
    throw new Error('expected shared 2D renderer order helper in config.render')
  }
  if (!renderConfigText.includes('export const getCanvas2dRendererMenuLabel')) {
    throw new Error('expected shared 2D renderer menu label helper in config.render')
  }
  if (!renderConfigText.includes('export const getCanvas2dRendererMenuDescription') || !renderConfigText.includes('export const getCanvas2dRendererMenuBadges')) {
    throw new Error('expected shared 2D renderer menu UX metadata helpers in config.render')
  }
  if (!renderConfigText.includes('export const isFlowEditorCanvas2dRenderer')) {
    throw new Error('expected shared Flow Editor renderer helper in config.render')
  }
  if (renderConfigText.includes('aliases:') || renderConfigText.includes('CANVAS_2D_RENDERER_ID_BY_ALIAS')) {
    throw new Error('expected shared renderer config to resolve canonical normalized tokens without alias lists')
  }
  if (!renderConfigText.includes('gitGraph') || !renderConfigText.includes('export const isGitGraphCanvas2dRenderer')) {
    throw new Error('expected GitGraph renderer to be registered through shared renderer config')
  }
  if (
    !renderConfigText.includes('dashboard') ||
    !renderConfigText.includes("surfaceId: 'dashboard'") ||
    !renderConfigText.includes('export const isDashboardCanvas2dRenderer') ||
    !renderConfigText.includes('!isDashboardCanvas2dRenderer(id)')
  ) {
    throw new Error('expected Dashboard renderer to be registered through shared renderer config and excluded from minimap')
  }
  if (!canvasViewportText.includes('getCanvas2dSurfaceId(canvas2dRenderer)')) {
    throw new Error('expected CanvasViewport to derive the active 2D surface from the shared renderer surface helper')
  }
  if (!canvasViewportText.includes("import('@/components/DashboardCanvas')") || !canvasViewportText.includes("active2dSurface === 'dashboard'")) {
    throw new Error('expected CanvasViewport to mount Dashboard through the shared 2D surface branch')
  }
  if (!canvasViewportText.includes("import('@/components/MermaidGitGraphCanvas')") || !canvasViewportText.includes("active2dSurface === 'gitGraph'")) {
    throw new Error('expected CanvasViewport to mount GitGraph through the shared 2D surface branch')
  }
  const blockedChartRuntimeTokens = [['chart', 'js'].join('.'), ['chart', 'js'].join('')]
  if (!dashboardCanvasText.includes("import * as d3 from 'd3'") || blockedChartRuntimeTokens.some(token => dashboardCanvasText.toLowerCase().includes(token))) {
    throw new Error('expected Dashboard renderer to reuse D3 and avoid introducing an alternate chart runtime')
  }
  if (
    !dashboardCanvasText.includes('buildScopedGraphSemanticKey') ||
    !dashboardCanvasText.includes('data-kg-dashboard-canvas="1"') ||
    !dashboardCanvasText.includes('data-kg-dashboard-grid-enabled')
  ) {
    throw new Error('expected Dashboard renderer to reuse shared semantic keys and expose neutral runtime markers')
  }
  if (!dashboardModelText.includes('readCanvasGridConfigFromSchema(schema)') || !dashboardModelText.includes('buildDashboardCanvasModel')) {
    throw new Error('expected Dashboard model to derive grid state from the shared canvas grid config')
  }
  if (!gitGraphCanvasText.includes('useSvgSurfaceZoomRuntime({') || !gitGraphCanvasText.includes('data-kg-gitgraph-interactive="1"')) {
    throw new Error('expected GitGraph renderer to delegate interaction to the shared SVG surface zoom runtime')
  }
  if (!gitGraphCanvasText.includes('selectedElementLabel: selectedCommandLabel') || !gitGraphCanvasText.includes('onSelectedElementLabelChange: handleSelectedElementLabelChange')) {
    throw new Error('expected GitGraph FloatingPanel selection to flow through the shared SVG surface runtime')
  }
  if (!svgSurfaceZoomRuntimeText.includes('readSelectedElementLabel?:') || !svgSurfaceZoomRuntimeText.includes('readSelectedElementLabel?.({ svgEl: args.svgEl, target, candidate })')) {
    throw new Error('expected shared SVG surface runtime to expose neutral clicked-element label resolution')
  }
  if (!svgSurfaceZoomRuntimeText.includes('resolveSelectedElementByLabel?:') || !svgSurfaceZoomRuntimeText.includes('readSelectedElementPeers?:')) {
    throw new Error('expected shared SVG surface runtime to let renderers keep related selected SVG parts undimmed')
  }
  if (
    !gitGraphCanvasText.includes('resolveGitGraphSvgElementLabel') ||
    !gitGraphCanvasText.includes('readGitGraphSvgElementLabelCandidates') ||
    !gitGraphCanvasText.includes('findGitGraphCommandForExactLabel') ||
    !gitGraphCanvasText.includes('resolveGitGraphSelectedSvgElementByLabel') ||
    !gitGraphCanvasText.includes('readGitGraphSelectedSvgElementPeers') ||
    !gitGraphCanvasText.includes("setFloatingPanelView('gitGraph')")
  ) {
    throw new Error('expected GitGraph canvas-to-row selection to resolve SVG labels through parsed commands and open the shared FloatingPanel')
  }
  if (
    !gitGraphFloatingPanelText.includes('data-kg-gitgraph-command-line') ||
    !gitGraphFloatingPanelText.includes("scrollIntoView({ block: 'center' })") ||
    !gitGraphFloatingPanelText.includes('ring-2')
  ) {
    throw new Error('expected GitGraph FloatingPanel rows to highlight and scroll to canvas-selected commands')
  }
  if (!gitGraphCanvasText.includes('[data-kg-svg-dimmed="1"]')) {
    throw new Error('expected GitGraph canvas to render shared SVG selection dimming markers')
  }
  if (gitGraphCanvasText.includes('[data-kg-svg-selected="1"]') || gitGraphCanvasText.includes('stroke: var(--kg-canvas-accent)') || gitGraphCanvasText.includes('paint-order: stroke')) {
    throw new Error('expected GitGraph row-to-canvas selection to avoid selected-SVG highlight styling while preserving dimming')
  }
  if (gitGraphCanvasText.includes('CardInlineTextEditor') || gitGraphCanvasText.includes('data-kg-gitgraph-crud-panel="1"')) {
    throw new Error('expected GitGraph canvas to stay SVG-only after command CRUD consolidation into FloatingPanel')
  }
  if (!gitGraphFloatingPanelText.includes('CardInlineTextEditor') || !gitGraphFloatingPanelText.includes('data-kg-gitgraph-floating-panel="1"')) {
    throw new Error('expected GitGraph FloatingPanel view to reuse the shared inline editor owner')
  }
  if (!gitGraphFloatingPanelText.includes("GITGRAPH_CREATE_ACTION_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-2 gap-1 px-1 sm:grid-cols-4'")) {
    throw new Error('expected GitGraph create actions to use a mobile-first responsive grid owner')
  }
  if (gitGraphFloatingPanelText.includes('grid grid-cols-4 gap-1 px-1')) {
    throw new Error('expected GitGraph create actions to avoid a fixed four-column mobile grid literal')
  }
  if (!gitGraphDocumentHookText.includes('replaceMermaidGitGraphCodeInMarkdown') || !gitGraphDocumentHookText.includes('writeWorkspaceSourceTextIfPresent')) {
    throw new Error('expected GitGraph interactive CRUD to write through shared source-text owners')
  }
  const gitGraphMarkdownSourceIndex = gitGraphDocumentHookText.indexOf('readYamlFrontmatterMermaidCode(markdownDocumentText || \'\')')
  const gitGraphParsedSourceIndex = gitGraphDocumentHookText.indexOf('readFrontmatterMermaidCode(graphData)')
  if (gitGraphMarkdownSourceIndex < 0 || gitGraphParsedSourceIndex < 0 || gitGraphMarkdownSourceIndex > gitGraphParsedSourceIndex) {
    throw new Error('expected GitGraph renderer to prefer live Markdown frontmatter over stale parsed graph metadata')
  }
  if (
    gitGraphCanvasText.includes('window.prompt(') ||
    gitGraphFloatingPanelText.includes('window.prompt(') ||
    gitGraphDocumentHookText.includes('localStorage.setItem(')
  ) {
    throw new Error('expected GitGraph interactive CRUD to avoid prompt/local renderer storage patches')
  }
  for (const token of [
    "import { createZoom } from '@/components/GraphCanvas/zoom'",
    "import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'",
    "import { fitAllTransform } from '@/components/GraphCanvas/fit'",
    'useAutoZoomModes2d({',
    'buildActive2dZoomViewKey({',
    'commitZoomTransformToStore({',
    'createRafLatestScheduler',
    'pickZoomStateForView({',
    'pickInitialZoomTransform({',
    'data-kg-svg-zoom-content',
    'data-kg-svg-viewport-hitbox',
    'data-kg-svg-selected',
    'data-kg-svg-dimmed',
    'data-kg-svg-has-selection',
    'setSelectedElementByLabel',
    'findSvgSelectionCandidateByLabel',
    'updateSvgSelectionDimming',
    'resolveSelectedElementByLabel',
    'readSelectedElementPeers',
    'buildSvgSurfaceGraphData({',
  ]) {
    if (!svgSurfaceZoomRuntimeText.includes(token)) {
      throw new Error(`expected SVG surface zoom runtime to reuse shared D3 viewport owner: ${token}`)
    }
  }
  if (
    gitGraphCanvasText.includes('ref={svgHostRef}\n          className="absolute inset-0 h-full w-full overflow-auto"') ||
    gitGraphCanvasText.includes('ref={svgHostRef}\n          className="absolute inset-0 h-full w-full overflow-scroll"')
  ) {
    throw new Error('expected GitGraph renderer to avoid scroll-only interaction after shared zoom runtime adoption')
  }
  for (const staleToken of ['knowgrph-gitgraph-demo', 'source_md', 'e2e_proof']) {
    if (gitGraphCanvasText.includes(staleToken) || svgSurfaceZoomRuntimeText.includes(staleToken)) {
      throw new Error('expected GitGraph interactive runtime to stay project- and file-agnostic')
    }
  }
  if (!canvasViewportText.includes('supportsCanvas2dMinimap(canvas2dRenderer)')) {
    throw new Error('expected CanvasViewport minimap gating to use the shared helper')
  }
  if (!canvasViewportText.includes("const FlowEditorCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/FlowEditorCanvas')")) {
    throw new Error('expected CanvasViewport to lazy-load the FlowEditorCanvas startup surface through the shared retry import path')
  }
  if (!rendererSelectText.includes('isD3Like2dRenderer(state.canvas2dRenderer)')) {
    throw new Error('expected Canvas2dRendererSelect to reuse the shared D3-like helper')
  }
  if (!canvasViewMenuText.includes('isD3Like2dRenderer(option.id)')) {
    throw new Error('expected Canvas view menu to reuse the shared D3-like helper for renderer option gating')
  }
  if (!canvasViewMenuText.includes('CANVAS_2D_RENDERER_ORDER.map')) {
    throw new Error('expected Canvas view menu renderer options to derive menu order from the shared renderer spec')
  }
  if (!canvasViewMenuText.includes('getCanvas2dRendererMenuLabel(id)')) {
    throw new Error('expected Canvas view menu renderer options to derive menu labels from the shared renderer spec')
  }
  if (!canvasViewMenuText.includes('getCanvas2dRendererMenuDescription(id)') || !canvasViewMenuText.includes('getCanvas2dRendererMenuBadges(id)')) {
    throw new Error('expected Canvas view menu renderer options to derive UX metadata from the shared renderer spec')
  }
  if (!rendererSelectText.includes('option.description') || !rendererSelectText.includes('option.badges')) {
    throw new Error('expected Canvas2dRendererSelect to render shared renderer UX metadata without local option aliases')
  }
  if (!rendererSelectText.includes('kg-toolbar-dropdown-option-copy') || !responsiveToolbarCssText.includes('--kg-toolbar-dropdown-width')) {
    throw new Error('expected rich renderer menu metadata to use shared toolbar sizing and copy wrapping primitives')
  }
  if (!animaticTimelineModelText.includes('buildScopedGraphSemanticKey') || !animaticTimelineModelText.includes("'animatic-timeline-model'")) {
    throw new Error('expected Animatic timeline model caching to reuse the shared graph semantic-key helper')
  }
  if (!toolbarRendererViewText.includes('isD3Like2dRenderer(canvas2dRenderer)')) {
    throw new Error('expected renderer settings panel to reuse the shared D3-like helper')
  }
  if (!rendererGraphTopologySummaryText.includes("RENDERER_GRAPH_TOPOLOGY_STATS_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-xs sm:grid-cols-2'")) {
    throw new Error('expected renderer topology stats to use a mobile-first responsive grid owner')
  }
  if (rendererGraphTopologySummaryText.includes('grid grid-cols-2 gap-x-3 gap-y-1 text-xs')) {
    throw new Error('expected renderer topology stats to avoid fixed mobile two-column grid literals')
  }
  if (!threeControlsText.includes('isD3Like2dRenderer(canvas2dRenderer)')) {
    throw new Error('expected Three controls bridge to reuse the shared D3-like helper')
  }
  if (
    !minimapText.includes('buildMinimapFlowEditorOverlaySubset({') ||
    !minimapFlowEditorOverlayProjectionText.includes('isFlowEditorCanvas2dRenderer(args.canvas2dRenderer)')
  ) {
    throw new Error('expected minimap overlay subset logic to reuse the shared Flow Editor helper')
  }
  if (!canvasSyncRuntimeText.includes('applyCanvasPreviewSyncPayload')) {
    throw new Error('expected CanvasSyncRuntime to delegate inbound preview-sync payload handling to the shared owner')
  }
  if (!canvasPreviewSyncInboundText.includes('isFlowEditorCanvas2dRenderer(store.canvas2dRenderer)')) {
    throw new Error('expected preview-sync inbound renderer lock to reuse the shared Flow Editor helper')
  }
  if (toolbarToolMenuText.includes('isFlowEditorCanvas2dRenderer')) {
    throw new Error('expected floating toolbar owner to avoid stale unused Flow Editor helper references')
  }
  if (!uiCopyText.includes('2D Renderer: Flow Canvas')) {
    throw new Error('expected Flow renderer to be labeled as 2D Renderer: Flow Canvas')
  }
  if (!uiCopyText.includes('2D Renderer: GitGraph')) {
    throw new Error('expected GitGraph renderer to be labeled as 2D Renderer: GitGraph')
  }
  if (!uiCopyText.includes('2D Renderer: Dashboard') || !canvasViewMenuText.includes('canvasViewRendererDashboardTitle')) {
    throw new Error('expected Dashboard renderer to be labeled and exposed through shared Canvas View copy')
  }
  if (!uiCopyText.includes('2D Renderer: Storyboard')) {
    throw new Error('expected Storyboard renderer to be labeled as 2D Renderer: Storyboard')
  }
  if (uiCopyText.includes('2D Renderer: Flow\'')) {
    throw new Error('expected legacy 2D Renderer: Flow naming to be removed')
  }
  if (!rendererRegistryText.includes("export { CANVAS_2D_RENDERER_ORDER, getCanvas2dRendererLabel } from '@/lib/config'")) {
    throw new Error('expected renderer registry to re-export shared renderer order and labels from the centralized renderer config')
  }
}

export function testWorkspaceJsonPipelineStaysNeutralAndFileAgnostic() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'hooks', 'active-graph-data', 'workspaceStructuredGraph.ts'), 'utf8')
  const perDocumentUiStateText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'persistence', 'perDocumentUiState.ts'), 'utf8')
  const canvasSliceText = readFileSync(resolve(process.cwd(), 'src', 'hooks', 'store', 'canvasSlice.ts'), 'utf8')
  if (!text.includes("const WORKSPACE_GRAPH_PARSE_HINT = 'workspace:inline-data'")) {
    throw new Error('expected neutral inline workspace parse hint for JSON fallback parsing')
  }
  if (text.includes("parseGraph(name || 'workspace.json', text)")) {
    throw new Error('expected workspace JSON fallback parsing to avoid file-specific workspace.json')
  }
  if (text.includes("parseGraph(name || 'workspace.data.json', text)")) {
    throw new Error('expected workspace JSON fallback parsing to avoid hardcoded .json file hints')
  }
  if (!text.includes('buildFlowchartSourceMeta({')) {
    throw new Error('expected workspace flowchart parsing to carry shared source metadata')
  }
  if (!text.includes("const WORKSPACE_GRAPH_SOURCE = 'workspace:graph'")) {
    throw new Error('expected workspace JSON pipeline to use a neutral workspace graph source identity')
  }
  if (!text.includes("const WORKSPACE_GRAPH_SOURCE_KIND = 'workspace'")) {
    throw new Error('expected workspace JSON pipeline to tag workspace source kind explicitly')
  }
  if (text.includes('return { ...graphData, nodes: [], edges: [] }')) {
    throw new Error('expected flowchart path to avoid synthetic empty graph placeholders')
  }
  if (!perDocumentUiStateText.includes('isCanvas2dRendererId(raw.canvas2dRenderer)')) {
    throw new Error('expected per-document UI persistence to reuse the shared 2D renderer id validator')
  }
  if (!canvasSliceText.includes('isCanvas2dRendererId(v) ? v : DEFAULT_CANVAS_2D_RENDERER')) {
    throw new Error('expected canvas slice bootstrap to reuse the shared 2D renderer id validator')
  }
}
