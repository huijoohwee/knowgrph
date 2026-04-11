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

export function testFlowEditorQuickEditorGridFollowsToolbarAndAvoidsRightDocking() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const flowText = readFileSync(flowEditorCanvasPath, 'utf8')
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const nodeText = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!flowText.includes('function readQuickEditorGridLayoutSettings(schema: unknown)')) {
    throw new Error('expected FlowEditor quick-editor layout to derive settings from toolbar grid behavior')
  }
  if (!flowText.includes('const quickEditorGrid = readQuickEditorGridLayoutSettings(schemaCur)')) {
    throw new Error('expected FlowEditor overlay collision/layout pass to read quick-editor grid settings')
  }
  if (!flowText.includes("const panelScale = computeNodeQuickEditorScale(zoomK, null, { mode: 'floating' })")) {
    throw new Error('expected quick-editor collision layout scale to keep floating-mode sizing path')
  }
  if (!flowText.includes('isFrontmatterFlow || quickEditorGrid.gridEnabled')) {
    throw new Error('expected quick-editor dock layout to use centered grid strategy when toolbar grid is enabled')
  }
  if (!flowText.includes('snapToGridPx(') || !flowText.includes('snapScreen(')) {
    throw new Error('expected quick-editor overlay positions to snap to toolbar grid increments')
  }
  if (!flowText.includes('const quickEditorGrid = readQuickEditorGridLayoutSettings(schema)')) {
    throw new Error('expected quick-editor seeded world positions to use toolbar grid settings')
  }

  if (nodeText.includes('floatingDockRef')) {
    throw new Error('expected quick-editor overlay to avoid right-edge floating dock ref behavior')
  }
  if (nodeText.includes("mode: 'right'")) {
    throw new Error('expected quick-editor overlay to avoid right-edge auto-docking mode')
  }
}

export function testFlowEditorQuickEditorPinDescriptionsAreActionClear() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const panelText = readFileSync(panelPath, 'utf8')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')
  const copyText = readFileSync(copyPath, 'utf8')
  const labelsPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiMeta.ts')
  const labelsText = readFileSync(labelsPath, 'utf8')

  if (!panelText.includes('title={pinned ? UI_LABELS.unpinPanel : UI_LABELS.pinPanel}')) {
    throw new Error('expected quick-editor pin button title to reflect explicit action for current state')
  }
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  if (!overlayText.includes('if (pinnedInCanvas) return')) {
    throw new Error('expected quick-editor header drag to be disabled only when pinned and enabled when unpinned')
  }
  if (!labelsText.includes("pinPanel: 'Pin to canvas (no drag)'")) {
    throw new Error('expected quick-editor pin label to clearly describe drag-disabled pinned behavior')
  }
  if (!labelsText.includes("unpinPanel: 'Unpin (drag enabled)'")) {
    throw new Error('expected quick-editor unpin label to clearly describe drag-enabled behavior')
  }
  if (!copyText.includes("flowNodeQuickEditorPin: 'Pin to canvas (follows canvas zoom/pan; drag disabled).'")) {
    throw new Error('expected quick-editor pin tooltip copy to state zoom-follow with drag disabled')
  }
  if (!copyText.includes("flowNodeQuickEditorUnpin: 'Unpin (follows canvas zoom/pan; drag enabled).'")) {
    throw new Error('expected quick-editor unpin tooltip copy to state zoom-follow with drag enabled')
  }
}

export function testFlowEditorOverlayEdgesPreferRailPortAnchorsOverScrollingDotAnchors() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  if (!text.includes('const dotBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="dot"]`)')) {
    throw new Error('expected overlay edge anchor selector to read dot handle candidate explicitly')
  }
  if (!text.includes('const railBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="rail"]`)')) {
    throw new Error('expected overlay edge anchor selector to read rail handle candidate explicitly')
  }
  if (!text.includes('const dotVisible = !!(')) {
    throw new Error('expected overlay edge anchor selector to gate dot usage by visible panel bounds')
  }
  if (!text.includes('const nextAnchor = (dotVisible ? dotAnchor : null) || railAnchor || dotAnchor || fallbackAnchor')) {
    throw new Error('expected overlay edge anchor selector to fallback to rail anchor when dot is out of panel view')
  }
  if (!text.includes('const clampedY =')) {
    throw new Error('expected overlay edge anchor position to clamp Y within quick-editor bounds')
  }
  if (!text.includes("const dotEl = btn.querySelector('span') as HTMLElement | null")) {
    throw new Error('expected overlay edge anchor to compute center from inner dot element when present')
  }
}

export function testFlowEditorPortHandleEdgeConnectivityUsesEndpointIdResolver() {
  const portHandlesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPortHandles.tsx')
  const portHandlesText = readFileSync(portHandlesPath, 'utf8')
  const handlesPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'handles.ts')
  const handlesText = readFileSync(handlesPath, 'utf8')
  const flowDataflowPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'flowDataflow.ts')
  const flowDataflowText = readFileSync(flowDataflowPath, 'utf8')
  const endpointHelperPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'edgeEndpoints.ts')
  const endpointHelperText = readFileSync(endpointHelperPath, 'utf8')

  if (!endpointHelperText.includes('export function readEdgeEndpointId')) {
    throw new Error('expected shared edge endpoint id resolver helper for object/string edge endpoint compatibility')
  }
  if (!portHandlesText.includes('readEdgeEndpointId(e?.source)') || !portHandlesText.includes('readEdgeEndpointId(e?.target)')) {
    throw new Error('expected quick-editor port handle edge coercion to resolve object-form edge endpoints via shared helper')
  }
  if (!handlesText.includes('readEdgeEndpointId((e as { source?: unknown })?.source)')) {
    throw new Error('expected flow handle computation to resolve source endpoint ids via shared helper')
  }
  if (!handlesText.includes('readEdgeEndpointId((e as { target?: unknown })?.target)')) {
    throw new Error('expected flow handle computation to resolve target endpoint ids via shared helper')
  }
  if (!flowDataflowText.includes('readEdgeEndpointId((e as unknown as { source?: unknown })?.source)')) {
    throw new Error('expected flow dataflow connected-value pipeline to resolve source endpoint ids via shared helper')
  }
  if (!flowDataflowText.includes('readEdgeEndpointId((e as unknown as { target?: unknown })?.target)')) {
    throw new Error('expected flow dataflow connected-value pipeline to resolve target endpoint ids via shared helper')
  }
}

export function testFlowEditorQuickEditorOverlaysForcePinnedToCanvasForZoomFollow() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  if (!text.includes('const forcePinnedToCanvas = true')) {
    throw new Error('expected FlowEditor overlay quick editors to force pinned-to-canvas so they follow infinite-canvas zoom')
  }
  if (!text.includes('if (forcePinnedToCanvas) return false')) {
    throw new Error('expected quick-editor collision initialization layout to keep forced-pinned overlays movable to prevent overlap chaos')
  }
  if (!text.includes("return typeof v === 'boolean' ? v : false")) {
    throw new Error('expected quick-editor collision initialization layout to default undefined pinned state to movable')
  }
}

export function testFlowEditorPinnedQuickEditorForbidsAccidentalDuplicateCopy() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const canvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const canvasText = readFileSync(canvasPath, 'utf8')
  if (!toolbarText.includes('duplicateDisabled: boolean')) {
    throw new Error('expected quick-editor actions toolbar to accept duplicateDisabled guard for accidental copy prevention')
  }
  if (!toolbarText.includes('disabled={!active || duplicateDisabled}')) {
    throw new Error('expected duplicate action to be disabled when accidental-copy guard is active')
  }
  if (!overlayText.includes('duplicateDisabled={pinnedInCanvas || forcePinnedToCanvas === true}')) {
    throw new Error('expected pinned or forced-canvas quick editor mode to activate duplicateDisabled guard')
  }
  if (!canvasText.includes('const pinned = forcePinnedToCanvas === true || pinnedMap[id] === true')) {
    throw new Error('expected quick-editor duplicate callback to guard pinned/forced-canvas state before copying')
  }
  if (!canvasText.includes('Pinned quick editor blocks duplicate copy.')) {
    throw new Error('expected quick-editor duplicate guard to notify user when copy is blocked in pinned mode')
  }
}
