import fs from 'node:fs'
import path from 'node:path'

import {
  resolveFlowCanvasNativeRenderPolicy,
  resolveFlowCanvasNativeSurfaceMode,
} from '@/components/FlowCanvas/shared'

export function testFlowEditorOverlaysDoNotUseFloatingPanelZIndex() {
  const filePath = path.resolve(process.cwd(), 'src/components/FlowEditor/NodeOverlayEditorInner.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (text.includes('floatingPanelZIndex') || text.includes('Z_INDEX_FLOATING_PANEL_DEFAULT')) {
    throw new Error('Expected Flow Editor node overlays to not derive z-index from floating panel z-index')
  }
  if (text.includes('5000') || text.includes('8000')) {
    throw new Error('Expected Flow Editor node overlays to avoid high hardcoded z-index values')
  }
  if (!text.includes('FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE') || !text.includes('FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED')) {
    throw new Error('Expected Flow Editor node overlays to use bounded z-index constants')
  }
  const sharedPath = path.resolve(process.cwd(), 'src/components/FlowEditor/nodeOverlayEditorShared.ts')
  let sharedText = ''
  try {
    sharedText = fs.readFileSync(sharedPath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${sharedPath}`)
  }
  if (
    !sharedText.includes("from '@/lib/ui/zIndex'")
    || !sharedText.includes('Z_INDEX_GRAPH_OVERLAY_BASE')
    || !sharedText.includes('Z_INDEX_GRAPH_OVERLAY_SELECTED')
  ) {
    throw new Error('Expected Flow Editor node overlays to reuse shared graph overlay z-index SSOT')
  }
}

export function testFlowEditorOverlaySvgIsBoundedBelowToolbar() {
  const filePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (text.includes('Z_INDEX_FLOATING_PANEL_DEFAULT) - 100') || text.includes('floatingPanelZIndex') && text.includes('- 100')) {
    throw new Error('Expected Flow Editor overlay-only SVG to avoid floating-panel-derived z-index')
  }
  if (!text.includes("from '@/lib/ui/zIndex'") || !text.includes('Z_INDEX_GRAPH_OVERLAY_EDGES')) {
    throw new Error('Expected Flow Editor overlay-only SVG to reuse shared graph overlay z-index SSOT')
  }
  if (text.includes('zIndex: 120')) {
    throw new Error('Expected Flow Editor overlay-only SVG to avoid hardcoded z-index values')
  }
}

export function testFlowEditorOverlayModeUsesSharedNativeSurfacePolicy() {
  const frontmatterMode = resolveFlowCanvasNativeSurfaceMode({
    canvas2dRenderer: 'flowEditor',
    graphData: { type: 'application/json', metadata: { kind: 'frontmatter-flow' }, nodes: [], edges: [] },
  })
  if (frontmatterMode !== 'runtime-only') {
    throw new Error('Expected frontmatter Flow Editor scenes to run FlowCanvas as a runtime-only substrate')
  }
  const overlayMode = resolveFlowCanvasNativeSurfaceMode({
    canvas2dRenderer: 'flowEditor',
    graphData: { type: 'application/json', nodes: [], edges: [] },
    overlayOwnsScene: true,
  })
  if (overlayMode !== 'runtime-only') {
    throw new Error('Expected overlay-owned Flow Editor scenes to run FlowCanvas as a runtime-only substrate')
  }
  const policy = resolveFlowCanvasNativeRenderPolicy({
    nativeSurfaceMode: overlayMode,
    renderEdges: true,
    renderGroups: true,
    renderNodes: true,
  })
  if (policy.renderEdges !== false || policy.renderGroups !== false || policy.renderNodes !== false) {
    throw new Error('Expected runtime-only FlowCanvas policy to disable native edges, groups, and nodes')
  }

  const flowCanvasPath = path.resolve(process.cwd(), 'src/components/FlowCanvas.tsx')
  const surfacePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx')
  let flowCanvasText = ''
  let surfaceText = ''
  try {
    flowCanvasText = fs.readFileSync(flowCanvasPath, { encoding: 'utf8' })
    surfaceText = fs.readFileSync(surfacePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${flowCanvasPath} and ${surfacePath}`)
  }
  if (!surfaceText.includes('nativeSurfaceMode={props.nativeSurfaceMode}')) {
    throw new Error('Expected Flow Editor to pass the shared native surface mode into FlowCanvas')
  }
  if (!flowCanvasText.includes('resolveFlowCanvasNativeRenderPolicy')) {
    throw new Error('Expected FlowCanvas to own the native primitive render policy')
  }
  if (
    !flowCanvasText.includes('drawArgsRef.current.renderEdges = nativeRenderPolicy.renderEdges')
    || !flowCanvasText.includes('drawArgsRef.current.renderGroups = nativeRenderPolicy.renderGroups')
    || !flowCanvasText.includes('drawArgsRef.current.renderNodes = nativeRenderPolicy.renderNodes')
  ) {
    throw new Error('Expected FlowCanvas draw args to use the resolved native render policy')
  }
  const runtimePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas.runtime.tsx')
  const runtimeText = fs.readFileSync(runtimePath, { encoding: 'utf8' })
  if (
    !runtimeText.includes('const flowEditorOverlayOwnsNativeScene = overlayOnlyActive')
    || !runtimeText.includes('hasOverlayEditors && workspaceMutationBlocked')
    || !runtimeText.includes('overlayOwnsScene: flowEditorOverlayOwnsNativeScene')
  ) {
    throw new Error('Expected visible Flow Editor overlays to keep FlowCanvas runtime-only while workspace mutation is blocked')
  }
}

export function testFlowEditorOverlayOnlyModeDoesNotBlankCanvasWhenNoOverlaysOpen() {
  const surfacePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx')
  const overlaySurfacePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorOverlaySurface.tsx')
  const overlayVisibilityPath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceVisibility.ts')
  let surfaceText = ''
  let overlaySurfaceText = ''
  try {
    surfaceText = fs.readFileSync(surfacePath, { encoding: 'utf8' })
    overlaySurfaceText = `${fs.readFileSync(overlaySurfacePath, { encoding: 'utf8' })}\n${fs.readFileSync(overlayVisibilityPath, { encoding: 'utf8' })}`
  } catch {
    throw new Error(`Expected to read ${surfacePath}, ${overlaySurfacePath}, and ${overlayVisibilityPath}`)
  }
  if (!overlaySurfaceText.includes('const overlayOnlyActive =')) {
    throw new Error('Expected Flow Editor overlay-only rendering to be gated by whether overlays exist')
  }
  if (!overlaySurfaceText.includes('hasOverlayEditors || Boolean(geospatialWidgetPanelMode)')) {
    throw new Error('Expected Flow Editor overlay-only mode to require visible overlays or geospatial panel mode')
  }
  if (surfaceText.includes('renderEdges=') || surfaceText.includes('renderNodes=')) {
    throw new Error('Expected Flow Editor surface to avoid owning native FlowCanvas edge/node visibility')
  }
  const defaultMode = resolveFlowCanvasNativeSurfaceMode({
    canvas2dRenderer: 'flowEditor',
    graphData: { type: 'application/json', nodes: [], edges: [] },
    overlayOwnsScene: false,
  })
  if (defaultMode !== 'visual') {
    throw new Error('Expected FlowCanvas auto mode to stay visual when no overlay/frontmatter owner exists')
  }
  if (!surfaceText.includes('{(props.overlayOnlyActive || props.hasOverlayEditors) && (')) {
    throw new Error('Expected overlay edge host to stay mounted while Flow Editor overlay editors are visible')
  }
}

export function testWorkspacePanesOutrankFlowEditorOverlays() {
  const filePath = path.resolve(process.cwd(), 'src/pages/Canvas.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('Workspace Toolbar Header') || !text.includes('z-[400]')) {
    throw new Error('Expected workspace header baseline to stay above the workspace editor shell and canvas overlays in split views')
  }
}

export function testGraphRichMediaOverlayLayersUseSharedLowZIndex() {
  const flowMediaPath = path.resolve(process.cwd(), 'src/components/FlowCanvas/FlowCanvasMediaOverlays.tsx')
  const d3MediaPath = path.resolve(process.cwd(), 'src/components/GraphCanvasRoot/components/RichMediaOverlayLayer2d.tsx')
  let flowMediaText = ''
  let d3MediaText = ''
  try {
    flowMediaText = fs.readFileSync(flowMediaPath, { encoding: 'utf8' })
    d3MediaText = fs.readFileSync(d3MediaPath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${flowMediaPath} and ${d3MediaPath}`)
  }
  if (flowMediaText.includes('2200') || flowMediaText.includes('1400')) {
    throw new Error('Expected Flow rich media overlays to avoid high per-item z-index hardcodes')
  }
  if (!flowMediaText.includes('Z_INDEX_GRAPH_MEDIA_LAYER') || !flowMediaText.includes('Z_INDEX_GRAPH_OVERLAY_SELECTED')) {
    throw new Error('Expected Flow rich media overlays to reuse shared graph overlay z-index SSOT')
  }
  if (d3MediaText.includes('z-[80]')) {
    throw new Error('Expected D3 rich media overlays to avoid hardcoded z-[80] layer value')
  }
  if (!d3MediaText.includes('Z_INDEX_GRAPH_MEDIA_LAYER')) {
    throw new Error('Expected D3 rich media overlays to reuse shared graph overlay z-index SSOT')
  }
}
