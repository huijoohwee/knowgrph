import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterUsesFlowFilterForQuickEditorOverlays() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('filterGraphToFrontmatterFlow')) {
    throw new Error('expected FlowEditorCanvas to filter frontmatter mode using frontmatter-flow graph filtering')
  }
  if (text.includes('filterGraphToFrontmatterMermaid')) {
    throw new Error('expected FlowEditorCanvas to avoid frontmatter-mermaid filtering for frontmatter-flow quick editor overlays')
  }
  if (!text.includes("if (kind === 'frontmatter-flow' && nodes.length > 0)")) {
    throw new Error('expected frontmatter-flow quick-editor derivation to always include all flow nodes')
  }
  if (text.includes('MAX_AUTO') || text.includes('MAX_VIEW')) {
    throw new Error('expected frontmatter-flow quick-editor derivation to avoid capped auto-open/viewport limits')
  }
}

export function testFrontmatterFlowTypedNodesForcePortHandleDefaultsInFlowScene() {
  const buildNativeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'buildNativeScene.ts')
  const text = readFileSync(buildNativeScenePath, 'utf8')

  if (!text.includes('shouldForceFrontmatterFlowTypedHandles')) {
    throw new Error('expected Flow scene builder to force default handles for frontmatter-flow typed nodes')
  }
  if (!text.includes("nodeTypeLower === 'input'")) {
    throw new Error('expected typed handle force rule to cover input nodes')
  }
  if (!text.includes("nodeTypeLower === 'default'")) {
    throw new Error('expected typed handle force rule to cover default nodes')
  }
  if (!text.includes("nodeTypeLower === 'output'")) {
    throw new Error('expected typed handle force rule to cover output nodes')
  }
  if (!text.includes("nodeTypeLower === 'custom'")) {
    throw new Error('expected typed handle force rule to cover custom nodes')
  }
}

export function testFlowEditorOverlayOnlyHideRequiresVisibleFrontmatterOverlayCoverage() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('frontmatterOverlayHideSafety')) {
    throw new Error('expected FlowEditor overlay mode to compute frontmatter visibility safety state')
  }
  if (!text.includes('hasFullOverlayCoverageForVisibleNodes')) {
    throw new Error('expected FlowEditor overlay safety to require complete overlay coverage for visible frontmatter-flow nodes')
  }
  if (!text.includes('overlayOnlySafeForCurrentView')) {
    throw new Error('expected FlowEditor overlay mode to gate node hiding by current-view overlay safety')
  }
  if (!text.includes('overlayOnlyModeEnabled && hasOverlayEditors && overlayOnlySafeForCurrentView')) {
    throw new Error('expected FlowEditor overlay-only mode activation to require strict coverage safety guard')
  }
}

export function testFrontmatterFlowQuickEditorFormShowsFlowContractAndOnlyShowsSmartMediaWhenConfigured() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')

  if (!text.includes("const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow'")) {
    throw new Error('expected quick-editor form to detect frontmatter-flow mode')
  }
  if (!text.includes('isSmartMediaRegistryEntry')) {
    throw new Error('expected quick-editor form to detect smart-media registry configuration')
  }
  if (!text.includes('const showSmartMediaFields = !hideFields && (!isFrontmatterFlow || hasSmartMediaSelection)')) {
    throw new Error('expected smart media field visibility to be gated by frontmatter-flow + user setup selection')
  }
  if (!text.includes('!hideFields && isFrontmatterFlow')) {
    throw new Error('expected dedicated frontmatter flow contract section rendering')
  }
  if (!text.includes('handles.target')) {
    throw new Error('expected frontmatter flow contract section to include handles.target')
  }
  if (!text.includes('handles.source')) {
    throw new Error('expected frontmatter flow contract section to include handles.source')
  }
  if (!text.includes('flow:compute')) {
    throw new Error('expected frontmatter flow contract section to bind flow:compute')
  }
  if (!text.includes('onPatchProperties({ data: parsed })')) {
    throw new Error('expected frontmatter flow contract section to parse and persist data json')
  }
}

export function testFlowEditorOverlayEdgeSchedulerStabilizesAcrossScrollPanZoom() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('overlayEdgeLayoutSigRef')) {
    throw new Error('expected overlay edge scheduler to cache layout signature and suppress redundant redraw churn')
  }
  if (!text.includes('overlayEdgeAnchorCacheRef')) {
    throw new Error('expected overlay edge scheduler to cache handle anchors and avoid temporary port disconnect jitter')
  }
  if (!text.includes('scrollLeft') || !text.includes('scrollTop')) {
    throw new Error('expected overlay edge layout signature to include overlay scroll offsets')
  }
  if (!text.includes("document.addEventListener('scroll', onAny, true)")) {
    throw new Error('expected overlay edge scheduler to listen to capture scroll updates for quick-editor scrolling')
  }
  if (!text.includes("document.addEventListener('wheel', onAny, { capture: true, passive: true })")) {
    throw new Error('expected overlay edge scheduler to listen to wheel updates for pan/zoom interaction stability')
  }
  if (!text.includes("root?.addEventListener('scroll', onAny, true)")) {
    throw new Error('expected overlay edge scheduler to bind root capture scroll updates')
  }
  if (!text.includes("root?.addEventListener('wheel', onAny, { capture: true, passive: true })")) {
    throw new Error('expected overlay edge scheduler to bind root capture wheel updates')
  }
  if (!text.includes("overlayEdgeLayoutSigRef.current = ''")) {
    throw new Error('expected overlay edge scheduler to invalidate layout signature on global interaction updates')
  }
  if (!text.includes('overlayEdgeAnchorCacheRef.current.clear()')) {
    throw new Error('expected overlay edge scheduler to invalidate anchor cache on global interaction updates')
  }
  if (!text.includes('const onInteractionFrame = () => {')) {
    throw new Error('expected overlay edge scheduler interaction-frame callback to run explicit invalidation before redraw')
  }
}

export function testFlowEditorQuickEditorFormEmitsInteractionFrameOnScrollAndWheel() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')

  if (!text.includes('FLOW_EDITOR_INTERACTION_FRAME_EVENT')) {
    throw new Error('expected quick-editor form to emit flow editor interaction frame event')
  }
  if (!text.includes('onScrollCapture={() => emitInteractionFrame()}')) {
    throw new Error('expected quick-editor form scroll to emit interaction frame for edge-anchor resync')
  }
  if (!text.includes('onWheelCapture={() => emitInteractionFrame()}')) {
    throw new Error('expected quick-editor form wheel to emit interaction frame for edge-anchor resync')
  }
}

export function testFlowEditorOverlayEdgesUseRendererEdgeTypeSsot() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('const globalEdgeType = readGlobalEdgeType(schema)')) {
    throw new Error('expected FlowEditor overlay edge rendering to use renderer edge-type SSOT from schema')
  }
  if (text.includes('frontmatterFlowRenderSettings?.edgeType || readGlobalEdgeType(schema)')) {
    throw new Error('expected FlowEditor overlay edge rendering to avoid frontmatter edge-type override over renderer edge-type SSOT')
  }
}

export function testQuickEditorInitUsesLayoutHydrationAndRafClampCommit() {
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!text.includes('useIsomorphicLayoutEffect(() => {') || !text.includes('resolveFloatingPos(quickEditorPos, defaultFloatingPos)')) {
    throw new Error('expected quick-editor floating position hydration to run in layout effect to avoid first-frame snap')
  }
  if (!text.includes('pendingClampCommitRef.current = requestAnimationFrame(() => {')) {
    throw new Error('expected quick-editor clamp commit to use raf scheduling for immediate stable alignment')
  }
  if (!text.includes('cancelAnimationFrame(pendingClampCommitRef.current)')) {
    throw new Error('expected quick-editor clamp scheduler to cancel stale raf commits')
  }
}

export function testFlowEditorOverlayEdgesPreferRailPortAnchorsOverScrollingDotAnchors() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  const railIdx = text.indexOf('data-kg-port-handle-kind="rail"')
  const dotIdx = text.indexOf('data-kg-port-handle-kind="dot"')
  if (railIdx < 0 || dotIdx < 0) {
    throw new Error('expected overlay edge anchor selector to include both rail and dot handle kinds')
  }
  if (railIdx > dotIdx) {
    throw new Error('expected overlay edge anchor selector to prefer stable rail handles before scrolling dot handles')
  }
  if (!text.includes("const dotEl = btn.querySelector('span') as HTMLElement | null")) {
    throw new Error('expected overlay edge anchor to compute center from inner dot element when present')
  }
}
