import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterUsesFlowFilterForQuickEditorOverlays() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('filterGraphToFlowQuickEditorEligible')) {
    throw new Error('expected FlowEditorCanvas to filter view graph using flow quick-editor eligibility filtering')
  }
  if (text.includes('filterGraphToFrontmatterMermaid')) {
    throw new Error('expected FlowEditorCanvas to avoid frontmatter-mermaid filtering for frontmatter-flow quick editor overlays')
  }
  if (!text.includes('isFrontmatterFlowGraph')) {
    throw new Error('expected FlowEditorCanvas to use shared frontmatter-flow graph detection helper')
  }
  if (!text.includes('if (isFrontmatterFlow && nodes.length > 0)')) {
    throw new Error('expected frontmatter-flow quick-editor derivation to always include all flow nodes')
  }
  if (!text.includes('FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY')) {
    throw new Error('expected frontmatter-flow quick-editor derivation to read flow quick-editor registry metadata key')
  }
  if (!text.includes('if (allowedFlowNodeIds.size === 0) return []')) {
    throw new Error('expected frontmatter-flow quick-editor derivation to avoid synthetic fallback when registry ids are missing')
  }
  if (!text.includes("if (!allowedFlowNodeIds.has(id)) continue")) {
    throw new Error('expected frontmatter-flow quick-editor derivation to exclude non-flow ids from overlay editors')
  }
  if (!text.includes('if (flowEditorFrontmatterGraphAvailable) return []')) {
    throw new Error('expected frontmatter-flow availability to suppress non-frontmatter quick-editor fallback ids')
  }
  if (!text.includes('if (!flowEditorViewActive) return []')) {
    throw new Error('expected flow editor quick-editor id derivation to avoid fallback ids whenever flow editor view is inactive')
  }
  if (!text.includes('forceFrontmatterFlow: frontmatterOnlyPolicyActive')) {
    throw new Error('expected Flow Editor to force flow-only graph-family derivation under frontmatter-only policy')
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

  if (!text.includes("const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow' || (nodeFormId && nodeFormId.startsWith('fm:'))")) {
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

export function testFrontmatterFlowContractSuppressesPortDotsForComputeAndDataRows() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')

  if (!text.includes("rowKey: 'flow-compute'")) {
    throw new Error('expected flow contract compute row to exist')
  }
  if (!text.includes("rowKey: 'flow-data'")) {
    throw new Error('expected flow contract data row to exist')
  }
  if (!text.includes('showInPortDot: false')) {
    throw new Error('expected flow contract to suppress input port dots for non-handle compute/data rows')
  }
  if (!text.includes('showOutPortDot: false')) {
    throw new Error('expected flow contract to suppress output port dots for non-handle compute/data rows')
  }
}

export function testQuickEditorWheelCaptureDoesNotBlockInternalScroll() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const text = readFileSync(panelPath, 'utf8')
  const wheelCaptureStart = text.indexOf('onWheelCapture={e => {')
  if (wheelCaptureStart < 0) {
    throw new Error('expected quick-editor panel wheel capture handler')
  }
  const wheelCaptureBlock = text.slice(wheelCaptureStart, Math.min(text.length, wheelCaptureStart + 420))
  if (!wheelCaptureBlock.includes('window.dispatchEvent(new Event(FLOW_EDITOR_INTERACTION_FRAME_EVENT))')) {
    throw new Error('expected quick-editor panel wheel capture to keep interaction-frame sync')
  }
  if (wheelCaptureBlock.includes('e.stopPropagation()')) {
    throw new Error('expected quick-editor panel wheel capture to avoid stopPropagation so internal panel scroll remains usable')
  }
}

export function testQuickEditorPortHandleTooltipUsesDirectionalHandlePath() {
  const portHandlesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPortHandles.tsx')
  const text = readFileSync(portHandlesPath, 'utf8')
  if (!text.includes('const handlePath = readFlowHandlePath(p.dir)')) {
    throw new Error('expected directional handle path mapping for port handles to reuse shared helper')
  }
  if (!text.includes('formatFlowHandleKeyValue({ dir: p.dir, portKey })')) {
    throw new Error('expected port-handle tooltip/aria to include directional key:value contract via shared helper')
  }
  if (!text.includes('data-kg-port-path={handlePath}')) {
    throw new Error('expected rendered port-handle elements to expose directional handle path metadata')
  }
}

export function testFrontmatterFlowContractFormatsHandlesAsKeyValuePathEntries() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  if (!text.includes('formatFlowHandleValueList')) {
    throw new Error('expected frontmatter flow contract to reuse shared handle value formatter')
  }
  if (!text.includes("value={formatFlowHandlePathValue(flowPortTypes.target)}")) {
    throw new Error('expected handles.target row value to render port key list in value column')
  }
  if (!text.includes("value={formatFlowHandlePathValue(flowPortTypes.source)}")) {
    throw new Error('expected handles.source row value to render port key list in value column')
  }
  if (!text.includes('{readFlowHandlePath(\'out\')}')) {
    throw new Error('expected handles.source key column to reuse shared directional path helper')
  }
  if (!text.includes('readFlowHandleTypeLabel(\'out\')')) {
    throw new Error('expected handles.source type column to render out direction label')
  }
}

export function testQuickEditorRegistryPortsUseDirectionalHandlePathKeyValue() {
  const registrySectionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorRegistrySection.tsx')
  const text = readFileSync(registrySectionPath, 'utf8')
  if (!text.includes('const handlePath = readFlowHandlePath(isIn ? \'in\' : \'out\')')) {
    throw new Error('expected quick-editor registry port rows to derive directional handle path from shared helper')
  }
  if (!text.includes('const handlePathValue = formatFlowHandleKeyValue({ dir: isIn ? \'in\' : \'out\', portKey })')) {
    throw new Error('expected quick-editor registry port rows to format key:value metadata via shared helper')
  }
  if (!text.includes('keyNode: <span className={cn(\'min-w-0 truncate\', UI_THEME_TOKENS.text.primary)}>{handlePath}</span>')) {
    throw new Error('expected quick-editor registry port key column to keep handles.source/handles.target path')
  }
  if (!text.includes('typeNode: <NodeOverlayEditorTypePill text={handleType} />')) {
    throw new Error('expected quick-editor registry port type column to render in/out direction')
  }
  if (!text.includes('valueNode: <span className={cn(\'min-w-0 truncate\', UI_THEME_TOKENS.text.primary)}>{portKey}</span>')) {
    throw new Error('expected quick-editor registry port value column to render standalone port key')
  }
}

export function testFrontmatterFlowContractPrefersRegistryHandlesWhenPortTypesAreUntyped() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  if (!text.includes('const flowRegistryHandles = React.useMemo(() => {')) {
    throw new Error('expected quick-editor flow contract to derive handles from registry ports')
  }
  if (!text.includes('const target = connectedFlowHandles.target.length > 0')) {
    throw new Error('expected target handle rows to prefer connected edge handles before registry/typed fallbacks')
  }
  if (!text.includes('const source = connectedFlowHandles.source.length > 0')) {
    throw new Error('expected source handle rows to prefer connected edge handles before registry/typed fallbacks')
  }
  if (!text.includes('value={formatFlowHandlePathValue(flowHandleKeys.source)}')) {
    throw new Error('expected handles.source value row to render unified flowHandleKeys source set')
  }
}

export function testFrontmatterFlowContractMakesSourceEditableAndTargetReadOnly() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  if (!text.includes("value={formatFlowHandlePathValue(flowHandleKeys.target)}")) {
    throw new Error('expected handles.target flow contract row to exist')
  }
  if (!text.includes("value={formatFlowHandlePathValue(flowHandleKeys.source)}")) {
    throw new Error('expected handles.source flow contract row to exist')
  }
  if (!text.includes('onChange={e => {') || !text.includes("onPatchProperties({ 'flow:portTypes': { in: inRec, out: nextOut } })")) {
    throw new Error('expected handles.source flow contract row to be editable and persist updates through flow:portTypes out map')
  }
  if (!text.includes('showPortRows={!isFrontmatterFlow}')) {
    throw new Error('expected frontmatter-flow mode to hide duplicate registry port rows')
  }
}

export function testFrontmatterFlowContractKeepsTwoDotColumnsAlignedForHandleRows() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const targetStart = text.indexOf("rowKey: 'flow-handles-target'")
  const sourceStart = text.indexOf("rowKey: 'flow-handles-source'")
  if (targetStart < 0 || sourceStart < 0) {
    throw new Error('expected frontmatter flow contract handle rows to be present')
  }
  const targetBlock = text.slice(targetStart, Math.min(text.length, sourceStart))
  const sourceEnd = text.indexOf("...(hasFlowCompute ? [{", sourceStart)
  const sourceBlock = text.slice(sourceStart, sourceEnd > sourceStart ? sourceEnd : Math.min(text.length, sourceStart + 1200))
  if (!text.includes('inPortNode: renderFlowContractDot({') || !text.includes('outPortNode: renderFlowContractDot({')) {
    throw new Error('expected flow contract handle rows to render explicit linked-state dot nodes')
  }
  if (targetBlock.includes('showOutPortDot: false') || sourceBlock.includes('showInPortDot: false')) {
    throw new Error('expected flow contract handle rows to keep opposite-side fallback dots for consistent | dot | key | type | value | dot | alignment')
  }
}

export function testFrontmatterFlowQuickEditorRegistryOptionsAreScopedToCurrentFormId() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  if (!text.includes('const flowRegistryFormId = String(properties[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] || \'\').trim()')) {
    throw new Error('expected frontmatter quick-editor registry scoping to read current node formId SSOT')
  }
  if (!text.includes('const flowRegistryFormIdExpected = flowRegistryFormId || `fm:${String(node.id || \'\').trim()}`')) {
    throw new Error('expected frontmatter quick-editor registry scoping to use node-id form fallback when explicit formId is absent')
  }
  if (!text.includes('if (!isFrontmatterFlow) return all')) {
    throw new Error('expected non-frontmatter behavior to keep existing nodeType-scoped registry options')
  }
  if (!text.includes('if (!expected) return []')) {
    throw new Error('expected frontmatter quick-editor registry options to avoid broad fallback when no resolvable form id exists')
  }
  if (!text.includes('return all.filter(entry => String(entry.formId || \'\').trim() === expected)')) {
    throw new Error('expected frontmatter quick-editor registry options to restrict to current node formId only')
  }
}

export function testQuickEditorRegistryMetadataMissingClearsDocumentRegistryToAvoidStaleFallbacks() {
  const graphDataSliceUtilsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSliceUtils.ts')
  const text = readFileSync(graphDataSliceUtilsPath, 'utf8')
  if (!text.includes('const metadataRecord = isRecord(metadata) ? metadata : ({} as Record<string, unknown>)')) {
    throw new Error('expected quick-editor registry metadata reader to coerce missing metadata to empty record')
  }
  if (!text.includes('const rawArr = Array.isArray(raw) ? raw : []')) {
    throw new Error('expected quick-editor registry metadata reader to treat missing registry payload as empty and clear stale entries')
  }
}

export function testFrontmatterFlowContractAvoidsSyntheticHandleAndDataFallbacks() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  if (!text.includes('const hasFlowTargetHandles = flowPortTypes.target.length > 0')) {
    throw new Error('expected frontmatter flow contract to gate handles.target row by actual declared handles')
  }
  if (!text.includes('const hasFlowSourceHandles = flowPortTypes.source.length > 0')) {
    throw new Error('expected frontmatter flow contract to gate handles.source row by actual declared handles')
  }
  if (!text.includes("if (typeof raw === 'undefined') return ''")) {
    throw new Error('expected frontmatter flow data renderer to avoid synthetic {} fallback when data key is absent')
  }
  if (!text.includes('onPatchProperties({ data: undefined })')) {
    throw new Error('expected frontmatter flow data editor clear action to remove data key instead of writing synthetic {}')
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

export function testFlowEditorDraftGraphHydrationIsNotClearedByFrontmatterRequirementGuard() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('const flowEditorBaseGraphData = React.useMemo((): GraphData | null => {')) {
    throw new Error('expected FlowEditor draft graph hydration to derive a stable Flow Editor graph-family source')
  }
  if (!text.includes('const base = flowEditorBaseGraphData as GraphData | null')) {
    throw new Error('expected FlowEditor draft graph hydration to avoid raw store graph fallback under view-lock transitions')
  }
  if (!text.includes('setDraftGraphData(prev => (prev === base ? prev : base))')) {
    throw new Error('expected FlowEditor draft graph hydration to stay aligned with base graph for stable zoom/minimap state')
  }
  if (text.includes('if (!canEdit) {\n      setDraftGraphData(prev => (prev === null ? prev : null))')) {
    throw new Error('expected FlowEditor draft graph hydration to avoid editability-driven clears that break zoom/minimap alignment')
  }
  if (text.includes('keywordModeActive')) {
    throw new Error('expected FlowEditor draft graph hydration to stay independent from keyword-mode coupling')
  }
}

export function testFlowEditorRenderGraphUsesBaseGraphWhenNotEditableForZoomMinimapAlignment() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  if (!text.includes('const flowEditorViewActive = active')) {
    throw new Error('expected Flow Editor view activation to stay renderer-scoped and independent from document modes')
  }
  if (!text.includes('const graphDataForRender = flowEditorViewActive ? draftGraphData : ((baseGraphData || null) as GraphData | null)')) {
    throw new Error('expected FlowEditor render graph source to keep draft graph active in Flow Editor view even when edit lock is ON')
  }
  if (!text.includes('graphData: graphDataForRender')) {
    throw new Error('expected FlowEditor render graph derivation to use unified graphDataForRender source')
  }
  if (!text.includes('if (!flowEditorViewActive) return []')) {
    throw new Error('expected quick-editor overlays to remain view-scoped instead of edit-lock scoped to avoid View Lock-induced renderer mutation')
  }
  if (!text.includes('visible={flowEditorViewActive}') || !text.includes('active={canEdit}')) {
    throw new Error('expected quick-editor overlays to stay visible in Flow Editor view while becoming read-only under View Lock')
  }
  if (text.includes('frontmatterDocumentModeActive')) {
    throw new Error('expected Flow Editor render graph source to avoid document-mode-only overlay gating')
  }
}

export function testFlowEditorInactiveWarmMountDoesNotMutateQuickEditorsAcrossRenderers() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  if (!text.includes('if (!active) return')) {
    throw new Error('expected FlowEditor quick-editor pruning effect to guard inactive warm mounts')
  }
  if (!text.includes('if (!flowEditorViewActive) return')) {
    throw new Error('expected FlowEditor quick-editor pruning effect to guard non-flow-editor view states')
  }
  if (!text.includes('updateOpenQuickEditorNodeIds(prev => prev.filter')) {
    throw new Error('expected FlowEditor quick-editor pruning effect to stay scoped to active Flow Editor view')
  }
  if (!text.includes('idSet.has(s)')) {
    throw new Error('expected FlowEditor quick-editor pruning effect to filter ids to current graph nodes')
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
