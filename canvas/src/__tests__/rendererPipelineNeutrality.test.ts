import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function test2dRendererPipelineUsesSharedSurfaceHelpers() {
  const root = resolve(process.cwd(), 'src')
  const renderConfigText = readFileSync(resolve(root, 'lib', 'config.render.ts'), 'utf8')
  const canvasPageText = readFileSync(resolve(root, 'pages', 'Canvas.tsx'), 'utf8')
  const canvasViewportText = readFileSync(resolve(root, 'components', 'CanvasViewport.tsx'), 'utf8')
  const rendererSelectText = readFileSync(resolve(root, 'components', 'toolbar', 'Canvas2dRendererSelect.tsx'), 'utf8')
  const canvasViewMenuText = readFileSync(resolve(root, 'components', 'toolbar', 'canvasViewMenu.ts'), 'utf8')
  const toolbarRendererViewText = readFileSync(resolve(root, 'features', 'toolbar', 'ToolbarToolMenuRendererView.tsx'), 'utf8')
  const threeControlsText = readFileSync(resolve(root, 'features', 'three', 'Controls.tsx'), 'utf8')
  const minimapText = readFileSync(resolve(root, 'features', 'minimap', 'Minimap.tsx'), 'utf8')
  const canvasSyncRuntimeText = readFileSync(resolve(root, 'features', 'canvas', 'CanvasSyncRuntime.tsx'), 'utf8')
  const toolbarToolMenuText = readFileSync(resolve(root, 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx'), 'utf8')

  if (!renderConfigText.includes('export const getCanvas2dSurfaceId')) {
    throw new Error('expected shared renderer surface helper in config.render')
  }
  if (!renderConfigText.includes('export const supportsCanvas2dMinimap')) {
    throw new Error('expected shared minimap support helper in config.render')
  }
  if (!renderConfigText.includes('export const isCanvas2dRendererId')) {
    throw new Error('expected shared 2D renderer id validator in config.render')
  }
  if (!renderConfigText.includes('export const isFlowEditorCanvas2dRenderer')) {
    throw new Error('expected shared Flow Editor renderer helper in config.render')
  }
  if (!canvasPageText.includes('getCanvas2dSurfaceId(canvas2dRenderer)')) {
    throw new Error('expected Canvas page to derive mounted 2D renderers from the shared surface helper')
  }
  if (!canvasViewportText.includes('supportsCanvas2dMinimap(canvas2dRenderer)')) {
    throw new Error('expected CanvasViewport minimap gating to use the shared helper')
  }
  if (!canvasViewportText.includes("importWithRetry(() => import('@/components/FlowEditorCanvas')")) {
    throw new Error('expected FlowEditorCanvas lazy loading to reuse importWithRetry for startup module fetch resilience')
  }
  if (!rendererSelectText.includes('isD3Like2dRenderer(state.canvas2dRenderer)')) {
    throw new Error('expected Canvas2dRendererSelect to reuse the shared D3-like helper')
  }
  if (!canvasViewMenuText.includes('isD3Like2dRenderer(option.id)')) {
    throw new Error('expected Canvas view menu to reuse the shared D3-like helper for renderer option gating')
  }
  if (!toolbarRendererViewText.includes('isD3Like2dRenderer(canvas2dRenderer)')) {
    throw new Error('expected renderer settings panel to reuse the shared D3-like helper')
  }
  if (!threeControlsText.includes('isD3Like2dRenderer(canvas2dRenderer)')) {
    throw new Error('expected Three controls bridge to reuse the shared D3-like helper')
  }
  if (!minimapText.includes('isFlowEditorCanvas2dRenderer(canvas2dRenderer)')) {
    throw new Error('expected minimap overlay subset logic to reuse the shared Flow Editor helper')
  }
  if (!canvasSyncRuntimeText.includes('isFlowEditorCanvas2dRenderer(store.canvas2dRenderer)')) {
    throw new Error('expected preview-sync renderer lock to reuse the shared Flow Editor helper')
  }
  if (!toolbarToolMenuText.includes('isFlowEditorCanvas2dRenderer(canvas2dRenderer)')) {
    throw new Error('expected toolbar inspector slot routing to reuse the shared Flow Editor helper')
  }
}

export function testWorkspaceJsonPipelineStaysNeutralAndFileAgnostic() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'hooks', 'useActiveGraphData.ts'), 'utf8')
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
  if (!text.includes('buildBipartiteSourceMeta({')) {
    throw new Error('expected workspace bipartite parsing to carry shared source metadata')
  }
  if (!text.includes("const WORKSPACE_GRAPH_SOURCE = 'workspace:graph'")) {
    throw new Error('expected workspace JSON pipeline to use a neutral workspace graph source identity')
  }
  if (!text.includes("const WORKSPACE_GRAPH_SOURCE_KIND = 'workspace'")) {
    throw new Error('expected workspace JSON pipeline to tag workspace source kind explicitly')
  }
  if (!perDocumentUiStateText.includes('isCanvas2dRendererId(raw.canvas2dRenderer)')) {
    throw new Error('expected per-document UI persistence to reuse the shared 2D renderer id validator')
  }
  if (!canvasSliceText.includes('isCanvas2dRendererId(v) ? v : DEFAULT_CANVAS_2D_RENDERER')) {
    throw new Error('expected canvas slice bootstrap to reuse the shared 2D renderer id validator')
  }
}
