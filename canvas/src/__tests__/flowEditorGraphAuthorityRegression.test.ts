import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function assertRenderStateUsesScopedGraphAuthority(renderStateText: string, message: string) {
  if (
    !renderStateText.includes('const baseForRender = args.flowEditorBaseGraphData || args.baseGraphData') ||
    !renderStateText.includes('shouldPreferScopedGraphDataAuthority({') ||
    !renderStateText.includes('candidateGraphData: draftGraphData') ||
    !renderStateText.includes('authorityGraphData: baseForRender') ||
    !renderStateText.includes(': (draftGraphData || baseForRender)')
  ) {
    throw new Error(message)
  }
}

export function testFlowEditorRenderGraphUsesBaseGraphWhenNotEditableForZoomMinimapAlignment() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const renderStateText = readFileSync(renderStatePath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const overlaySurfaceElementsText = readFileSync(overlaySurfaceElementsPath, 'utf8')
  if (!runtimeText.includes('const flowEditorViewActive = editorRuntimeActive')) {
    throw new Error('expected Flow Editor view activation to stay renderer-scoped and independent from document modes')
  }
  assertRenderStateUsesScopedGraphAuthority(
    renderStateText,
    'expected FlowEditor render graph source to use draft graph in active Flow Editor view unless shared scoped authority proves base graph ownership',
  )
  if (!renderStateText.includes('graphData: graphDataForRender')) throw new Error('expected FlowEditor render graph derivation to use unified graphDataForRender source')
  if (!overlaySurfaceText.includes('if (!flowEditorViewActive) {') || !overlaySurfaceText.includes('return []')) {
    throw new Error('expected widget overlays to remain view-scoped instead of edit-lock scoped to avoid View Lock-induced renderer mutation')
  }
  if (!overlaySurfaceElementsText.includes('visible={args.overlayVisibilityActive}') || !overlaySurfaceElementsText.includes('active={args.canEdit}')) {
    throw new Error('expected widget overlays to stay visible in Flow Editor view while becoming read-only under View Lock')
  }
  if (runtimeText.includes('frontmatterDocumentModeActive') || renderStateText.includes('frontmatterDocumentModeActive')) {
    throw new Error('expected Flow Editor render graph source to avoid document-mode-only overlay gating')
  }
}

export function testFrontmatterFlowLandingKeepsWidgetsVisibleAgainstSiblingRendererInterference() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const selectionBookkeepingPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorSelectionBookkeeping.ts')
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const frontmatterFlowLandingText = [
    'kgCanvas2dRenderer: "flowEditor"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
  ].join('\n')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const renderStateText = readFileSync(renderStatePath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const overlaySurfaceElementsText = readFileSync(overlaySurfaceElementsPath, 'utf8')
  const selectionBookkeepingText = readFileSync(selectionBookkeepingPath, 'utf8')
  const flowCanvasText = readFileSync(flowCanvasPath, 'utf8')

  if (!frontmatterFlowLandingText.includes('kgCanvas2dRenderer: "flowEditor"')) {
    throw new Error('expected generic frontmatter-flow landing fixture to keep Flow Editor as the canonical frontmatter-selected 2D renderer')
  }
  if (!frontmatterFlowLandingText.includes('kgDocumentSemanticMode: "document"') || !frontmatterFlowLandingText.includes('kgFrontmatterModeEnabled: true')) {
    throw new Error('expected generic frontmatter-flow landing fixture to keep document frontmatter mode enabled for widget-visible landing')
  }
  if (!runtimeText.includes('const flowEditorViewActive = editorRuntimeActive')) {
    throw new Error('expected frontmatter-flow Flow Editor view visibility to stay bound to the active Flow Editor renderer, not sibling renderer mounts')
  }
  assertRenderStateUsesScopedGraphAuthority(
    renderStateText,
    'expected frontmatter-flow Flow Editor render state to keep draft graph visibility scoped through the shared graph authority helper',
  )
  if (!overlaySurfaceText.includes('if (!flowEditorViewActive) {') || !overlaySurfaceText.includes('return []')) {
    throw new Error('expected frontmatter-flow widget overlays to stay view-scoped so inactive Flow Canvas/Flowchart mounts cannot keep or blank widget overlays')
  }
  if (!overlaySurfaceElementsText.includes('visible={args.overlayVisibilityActive}') || !overlaySurfaceElementsText.includes('active={args.canEdit}')) {
    throw new Error('expected frontmatter-flow widget overlays to remain visible in Flow Editor view while decoupling visibility from editability')
  }
  if (!selectionBookkeepingText.includes('if (!editorRuntimeActive || !flowEditorViewActive || !draftGraphData) return')) {
    throw new Error('expected frontmatter-flow widget bookkeeping to avoid pruning or mutating visible widget ids from inactive renderer paths')
  }
  if (!flowCanvasText.includes("if (canvas2dRenderer === 'flowEditor') {")) {
    throw new Error('expected Flow Canvas draw args to expose widget overlay state only for the active Flow Editor renderer')
  }
  if (
    !flowCanvasText.includes('drawArgsRef.current.flowEditorWidgetOpenNodeIds = undefined')
    || !flowCanvasText.includes('drawArgsRef.current.flowEditorWidgetPinnedByNodeId = undefined')
    || !flowCanvasText.includes('drawArgsRef.current.flowEditorWidgetWorldPosByNodeId = undefined')
  ) {
    throw new Error('expected inactive Flow Canvas/Flowchart renderer paths to clear Flow Editor widget draw-state instead of reusing stale visibility state')
  }
  if (flowCanvasText.includes('resolveFlowCanvasNativeRenderPolicy') || flowCanvasText.includes('drawArgsRef.current.renderNodes') || flowCanvasText.includes('drawArgsRef.current.renderEdges')) {
    throw new Error('expected Flow Editor renderer isolation to avoid suppressing FlowCanvas native primitives')
  }
}
