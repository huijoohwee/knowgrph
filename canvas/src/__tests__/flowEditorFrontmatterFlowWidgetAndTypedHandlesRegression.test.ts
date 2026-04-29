import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterUsesFlowFilterForWidgetOverlays() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('filterGraphToFlowWidgetEligible')) {
    throw new Error('expected FlowEditorCanvas to filter view graph using flow widget eligibility filtering')
  }
  if (text.includes('filterGraphToFrontmatterMermaid')) {
    throw new Error('expected FlowEditorCanvas to avoid frontmatter-mermaid filtering for frontmatter-flow widget overlays')
  }
  if (!text.includes('isFrontmatterFlowGraph')) {
    throw new Error('expected FlowEditorCanvas to use shared frontmatter-flow graph detection helper')
  }
  if (!text.includes('if (isFrontmatterFlow && nodes.length > 0)')) {
    throw new Error('expected frontmatter-flow widget derivation to always include all flow nodes')
  }
  if (!text.includes('FLOW_WIDGET_REGISTRY_METADATA_KEY')) {
    throw new Error('expected frontmatter-flow widget derivation to read flow widget registry metadata key')
  }
  if (!text.includes('if (allowedFlowNodeIds.size === 0) return []')) {
    throw new Error('expected frontmatter-flow widget derivation to avoid synthetic fallback when registry ids are missing')
  }
  if (!text.includes('for (const id of eligibleIds) allowedFlowNodeIds.add(id)')) {
    throw new Error('expected frontmatter-flow widget derivation to fall back to eligible node ids')
  }
  if (!text.includes("if (!allowedFlowNodeIds.has(id)) continue")) {
    throw new Error('expected frontmatter-flow widget derivation to exclude non-flow ids from overlay editors')
  }
  if (!text.includes('if (flowEditorFrontmatterGraphAvailable) return []')) {
    throw new Error('expected frontmatter-flow availability to suppress non-frontmatter widget fallback ids')
  }
  if (!text.includes('if (!flowEditorViewActive) return []')) {
    throw new Error('expected flow editor widget id derivation to avoid fallback ids whenever flow editor view is inactive')
  }
  if (!text.includes('forceFrontmatterFlow: frontmatterOnlyPolicyActive')) {
    throw new Error('expected Flow Editor to force flow-only graph-family derivation under frontmatter-only policy')
  }
  if (text.includes('MAX_AUTO') || text.includes('MAX_VIEW')) {
    throw new Error('expected frontmatter-flow widget derivation to avoid capped auto-open/viewport limits')
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
  if (!text.includes('overlayOnlyModeEnabled && overlayOnlySafeForCurrentView && (hasOverlayEditors || geospatialWidgetPanelMode)')) {
    throw new Error('expected FlowEditor overlay-only mode activation to require strict coverage safety guard')
  }
  if (!text.includes('deriveSceneDisplayGraph({ graphData: renderGraphDataOverride })')) {
    throw new Error('expected frontmatter overlay safety to derive visible flow coverage from the shared scene display graph')
  }
  if (!text.includes('const visibleFlowNodeIds = visibleNodeIds.filter')) {
    throw new Error('expected frontmatter overlay safety to limit coverage checks to visible flow-widget nodes')
  }
}

export function testFrontmatterFlowWidgetFormShowsFlowContractAndOnlyShowsSmartMediaWhenConfigured() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')

  if (!text.includes("const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow'")) {
    throw new Error('expected widget form to detect frontmatter-flow mode')
  }
  if (!text.includes('isSmartMediaRegistryEntry')) {
    throw new Error('expected widget form to detect smart-media registry configuration')
  }
  if (!text.includes('const showSmartMediaFields = !hideFields && (!isFrontmatterFlow || hasSmartMediaSelection)')) {
    throw new Error('expected smart media field visibility to be gated by frontmatter-flow + user setup selection')
  }
  if (!text.includes('!hideFields && isFrontmatterFlow')) {
    throw new Error('expected dedicated frontmatter flow contract section rendering')
  }
  if (!text.includes("rowKey: 'flow-handles-target'")) {
    throw new Error('expected frontmatter flow contract section to include target handle row')
  }
  if (!text.includes("rowKey: 'flow-handles-source'")) {
    throw new Error('expected frontmatter flow contract section to include source handle row')
  }
  if (!text.includes('flow:compute')) {
    throw new Error('expected frontmatter flow contract section to bind flow:compute')
  }
  if (!text.includes('FRONTMATTER_FLOW_WIDGET_FIELDS_KEY')) {
    throw new Error('expected frontmatter flow contract section to read declared widget envelope fields metadata')
  }
  if (!text.includes('readObjectPathValue(properties as Record<string, unknown>, schemaPath)')) {
    throw new Error('expected frontmatter flow contract section to render declared envelope field values by schema path')
  }
  if (!text.includes('onPatchProperties({ data: parsed })')) {
    throw new Error('expected frontmatter flow contract section to parse and persist data json')
  }
}

export function testFrontmatterWidgetOverlayPointerCaptureSkipsInteractiveControls() {
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!text.includes("const isInteractiveControl = !!el?.closest('input,textarea,select,button,[contenteditable=\"true\"]')")) {
    throw new Error('expected widget overlay pointer capture to classify native interactive controls once at the root')
  }
  if (!text.includes('if (active && ev.button === 0 && isInteractiveControl) return')) {
    throw new Error('expected widget overlay pointer capture to avoid selection churn while interacting with native form controls')
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
    throw new Error('expected overlay edge scheduler to listen to capture scroll updates for widget scrolling')
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
  if (!text.includes('getEdgeBaseStroke') || !text.includes('getEdgeStrokeWidth')) {
    throw new Error('expected overlay edge renderer to reuse shared graph edge stroke and width resolvers')
  }
}

export function testFlowEditorOverlayEdgesUseCanonicalOverlayNodeSet() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('const overlayEditorNodeIdsRef = React.useRef<string[]>([])')) {
    throw new Error('expected FlowEditor overlay edge renderer to keep a ref of canonical overlay editor node ids')
  }
  if (!text.includes('overlayEditorNodeIdsRef.current = overlayEditorNodeIds')) {
    throw new Error('expected FlowEditor overlay edge renderer to sync the canonical overlay editor node id ref')
  }
  if (!text.includes('Array.isArray(overlayEditorNodeIdsRef.current) && overlayEditorNodeIdsRef.current.length > 0')) {
    throw new Error('expected overlay edge renderer to prefer canonical overlay editor ids over open widget ids')
  }
  if (!text.includes('? overlayEditorNodeIdsRef.current')) {
    throw new Error('expected overlay edge renderer to draw from canonical overlay editor ids when overlay-only mode is active')
  }
}

export function testFrontmatterFlowOverlayEditorsIncludeCanonicalBuiltInWidgets() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('function isCanonicalFrontmatterBuiltInWidgetNode')) {
    throw new Error('expected FlowEditorCanvas to centralize canonical built-in frontmatter widget detection')
  }
  if (!text.includes('isCanonicalFrontmatterBuiltInWidgetNode(n)')) {
    throw new Error('expected frontmatter overlay derivation to recognize canonical built-in widget nodes')
  }
  if (!text.includes('allowedFlowNodeIds.add(id)')) {
    throw new Error('expected frontmatter overlay derivation to keep canonical built-in widget ids in the overlay set')
  }
}

export function testFlowEditorWidgetFormEmitsInteractionFrameOnScrollAndWheel() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')

  if (!text.includes('emitFlowEditorInteractionFrame')) {
    throw new Error('expected widget form to reuse the shared flow editor interaction frame emitter')
  }
  if (!text.includes('onScrollCapture={() => emitInteractionFrame()}')) {
    throw new Error('expected widget form scroll to emit interaction frame for edge-anchor resync')
  }
  if (!text.includes('onWheelCapture={() => emitInteractionFrame()}')) {
    throw new Error('expected widget form wheel to emit interaction frame for edge-anchor resync')
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

export function testWidgetWheelCaptureDoesNotBlockInternalScroll() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const text = readFileSync(panelPath, 'utf8')
  const wheelCaptureStart = text.indexOf('onWheelCapture={e => {')
  if (wheelCaptureStart < 0) {
    throw new Error('expected widget panel wheel capture handler')
  }
  const wheelCaptureBlock = text.slice(wheelCaptureStart, Math.min(text.length, wheelCaptureStart + 420))
  if (!wheelCaptureBlock.includes('emitFlowEditorInteractionFrame()')) {
    throw new Error('expected widget panel wheel capture to keep interaction-frame sync through the shared emitter')
  }
  if (wheelCaptureBlock.includes('e.stopPropagation()')) {
    throw new Error('expected widget panel wheel capture to avoid stopPropagation so internal panel scroll remains usable')
  }
}

export function testWidgetPortHandleTooltipUsesDirectionalHandlePath() {
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

export function testWidgetKvTableMaintainsFiveColumnLayoutAndValueContainment() {
  const kvTablePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorKvTable.tsx')
  const text = readFileSync(kvTablePath, 'utf8')
  if (!text.includes("<col style={{ width: '29%' }} />")) {
    throw new Error('expected KV table key column width contract')
  }
  if (!text.includes("<col style={{ width: '10%' }} />")) {
    throw new Error('expected KV table type column width contract')
  }
  if (!text.includes("<col style={{ width: '59%' }} />")) {
    throw new Error('expected KV table value column width contract')
  }
  if (!text.includes("className={cn('px-3 py-2 align-top overflow-hidden'")) {
    throw new Error('expected KV table value column to enforce overflow containment')
  }
  if (!text.includes('<section className="w-full min-w-0">{row.valueNode}</section>')) {
    throw new Error('expected KV table value node wrapper to enforce min-width alignment stability')
  }
}

export function testWidgetKvTableKeepsDimRingPlaceholderDotsForNonEdgeRows() {
  const kvTablePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorKvTable.tsx')
  const text = readFileSync(kvTablePath, 'utf8')
  if (!text.includes('disabled')) {
    throw new Error('expected placeholder dots to stay non-interactive for non-edge rows')
  }
  if (!text.includes("'opacity-50'")) {
    throw new Error('expected placeholder dots to keep dim styling')
  }
  if (!text.includes('rounded-full border')) {
    throw new Error('expected placeholder dots to keep ring style')
  }
}

export function testWidgetRegistryPortsUseDirectionalHandlePathKeyValue() {
  const registrySectionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorRegistrySection.tsx')
  const text = readFileSync(registrySectionPath, 'utf8')
  if (!text.includes('const handlePath = readFlowHandlePath(isIn ? \'in\' : \'out\')')) {
    throw new Error('expected widget registry port rows to derive directional handle path from shared helper')
  }
  if (!text.includes('const handlePathValue = formatFlowHandleKeyValue({ dir: isIn ? \'in\' : \'out\', portKey })')) {
    throw new Error('expected widget registry port rows to format key:value metadata via shared helper')
  }
  if (!text.includes('const portValueId = ids.registryField(`port-${p.direction}-${portKey}`)')) {
    throw new Error('expected widget registry port rows to derive a shared SSOT value id for label/input typography')
  }
  if (!text.includes('<label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={portValueId}>')) {
    throw new Error('expected widget registry port key column to reuse shared key label typography')
  }
  if (!text.includes('typeNode: <NodeOverlayEditorTypePill text={handleType} />')) {
    throw new Error('expected widget registry port type column to render in/out direction')
  }
  if (!text.includes('<PlainTextInputEditor')) {
    throw new Error('expected widget registry port value column to reuse shared text-input typography')
  }
  if (!text.includes('value={portKey}')) {
    throw new Error('expected widget registry port value column to render standalone port key')
  }
  if (!text.includes('disabled') || !text.includes('readOnly')) {
    throw new Error('expected widget registry port value column to stay read-only while reusing shared value styling')
  }
}

export function testFrontmatterFlowContractPrefersRegistryHandlesWhenPortTypesAreUntyped() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  if (!text.includes('const flowRegistryHandles = React.useMemo(() => {')) {
    throw new Error('expected widget flow contract to derive handles from registry ports')
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
  if (!text.includes('const hideFrontmatterFlowContractRows = showFrontmatterWidgetRegistrySection')) {
    throw new Error('expected built-in frontmatter widgets to collapse duplicate flow-contract rows into the shared registry surface')
  }
  if (!text.includes('const frontmatterWidgetIdentityLabel = React.useMemo(() => {')) {
    throw new Error('expected built-in frontmatter widgets to derive a canonical Widget identity row from shared registry label helpers')
  }
  if (!text.includes('ariaLabel={UI_LABELS.flowWidget}')) {
    throw new Error('expected built-in frontmatter widgets to render the canonical Widget identity row')
  }
  if (!text.includes('showPortRows')) {
    throw new Error('expected frontmatter widget registry section to keep canonical port rows visible')
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

export function testFrontmatterFlowWidgetRegistryOptionsAreScopedToCurrentFormId() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  if (!text.includes('const flowRegistryFormId = String(properties[FLOW_WIDGET_FORM_ID_KEY] || \'\').trim()')) {
    throw new Error('expected frontmatter widget registry scoping to read current node formId SSOT')
  }
  if (!text.includes('const flowRegistryFormIdExpected = flowRegistryFormId || `fm:${String(node.id || \'\').trim()}`')) {
    throw new Error('expected frontmatter widget registry scoping to use node-id form fallback when explicit formId is absent')
  }
  if (!text.includes('if (!isFrontmatterFlow) return all')) {
    throw new Error('expected non-frontmatter behavior to keep existing nodeType-scoped registry options')
  }
  if (!text.includes('if (!expected) return []')) {
    throw new Error('expected frontmatter widget registry options to avoid broad fallback when no resolvable form id exists')
  }
  if (!text.includes('return all.filter(entry => String(entry.formId || \'\').trim() === expected)')) {
    throw new Error('expected frontmatter widget registry options to restrict to current node formId only')
  }
}

export function testWidgetRegistryMetadataMissingClearsDocumentRegistryToAvoidStaleFallbacks() {
  const graphDataSliceUtilsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSliceUtils.ts')
  const text = readFileSync(graphDataSliceUtilsPath, 'utf8')
  if (!text.includes('const metadataRecord = isRecord(metadata) ? metadata : ({} as Record<string, unknown>)')) {
    throw new Error('expected widget registry metadata reader to coerce missing metadata to empty record')
  }
  if (!text.includes('const rawArr = Array.isArray(raw) ? raw : []')) {
    throw new Error('expected widget registry metadata reader to treat missing registry payload as empty and clear stale entries')
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
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const renderStateText = readFileSync(renderStatePath, 'utf8')

  if (!runtimeText.includes('const flowEditorBaseGraphData = React.useMemo(')) {
    throw new Error('expected FlowEditor draft graph hydration to derive a stable Flow Editor graph-family source')
  }
  if (!renderStateText.includes('const base = args.flowEditorBaseGraphData as GraphData | null')) {
    throw new Error('expected FlowEditor draft graph hydration to avoid raw store graph fallback under view-lock transitions')
  }
  if (!renderStateText.includes('setDraftGraphData(prev => (prev === base ? prev : base))')) {
    throw new Error('expected FlowEditor draft graph hydration to stay aligned with base graph for stable zoom/minimap state')
  }
  if (renderStateText.includes('if (!canEdit) {\n      setDraftGraphData(prev => (prev === null ? prev : null))')) {
    throw new Error('expected FlowEditor draft graph hydration to avoid editability-driven clears that break zoom/minimap alignment')
  }
  if (runtimeText.includes('keywordModeActive') || renderStateText.includes('keywordModeActive')) {
    throw new Error('expected FlowEditor draft graph hydration to stay independent from keyword-mode coupling')
  }
}

export function testFlowEditorRenderGraphUsesBaseGraphWhenNotEditableForZoomMinimapAlignment() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const renderStateText = readFileSync(renderStatePath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  if (!runtimeText.includes('const flowEditorViewActive = editorRuntimeActive')) {
    throw new Error('expected Flow Editor view activation to stay renderer-scoped and independent from document modes')
  }
  if (!renderStateText.includes('const graphDataForRender = args.flowEditorViewActive ? draftGraphData : args.baseGraphData')) {
    throw new Error('expected FlowEditor render graph source to keep draft graph active in Flow Editor view even when edit lock is ON')
  }
  if (!renderStateText.includes('graphData: graphDataForRender')) {
    throw new Error('expected FlowEditor render graph derivation to use unified graphDataForRender source')
  }
  if (!overlaySurfaceText.includes('if (!args.flowEditorViewActive) return []')) {
    throw new Error('expected widget overlays to remain view-scoped instead of edit-lock scoped to avoid View Lock-induced renderer mutation')
  }
  if (!overlaySurfaceText.includes('visible={args.flowEditorViewActive}') || !overlaySurfaceText.includes('active={args.canEdit}')) {
    throw new Error('expected widget overlays to stay visible in Flow Editor view while becoming read-only under View Lock')
  }
  if (runtimeText.includes('frontmatterDocumentModeActive') || renderStateText.includes('frontmatterDocumentModeActive')) {
    throw new Error('expected Flow Editor render graph source to avoid document-mode-only overlay gating')
  }
}

export function testFlowEditorInactiveWarmMountDoesNotMutateWidgetsAcrossRenderers() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  if (!text.includes('if (!active) return')) {
    throw new Error('expected FlowEditor widget pruning effect to guard inactive warm mounts')
  }
  if (!text.includes('if (!flowEditorViewActive) return')) {
    throw new Error('expected FlowEditor widget pruning effect to guard non-flow-editor view states')
  }
  if (!text.includes('updateOpenWidgetNodeIds(prev => prev.filter')) {
    throw new Error('expected FlowEditor widget pruning effect to stay scoped to active Flow Editor view')
  }
  if (!text.includes('idSet.has(s)')) {
    throw new Error('expected FlowEditor widget pruning effect to filter ids to current graph nodes')
  }
}

export function testWidgetInitUsesLayoutHydrationAndRafClampCommit() {
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!text.includes('useIsomorphicLayoutEffect(() => {') || !text.includes('resolveFloatingPos(widgetPos, defaultFloatingPos)')) {
    throw new Error('expected widget floating position hydration to run in layout effect to avoid first-frame snap')
  }
  if (!text.includes('pendingClampCommitRef.current = requestAnimationFrame(() => {')) {
    throw new Error('expected widget clamp commit to use raf scheduling for immediate stable alignment')
  }
  if (!text.includes('cancelAnimationFrame(pendingClampCommitRef.current)')) {
    throw new Error('expected widget clamp scheduler to cancel stale raf commits')
  }
}

export function testFlowEditorWidgetGridFollowsToolbarAndAvoidsRightDocking() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const flowText = readFileSync(flowEditorCanvasPath, 'utf8')
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const nodeText = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!flowText.includes('function readWidgetGridLayoutSettings(schema: unknown)')) {
    throw new Error('expected FlowEditor widget layout to derive settings from toolbar grid behavior')
  }
  if (!flowText.includes('const widgetGrid = readWidgetGridLayoutSettings(schemaCur)')) {
    throw new Error('expected FlowEditor overlay collision/layout pass to read widget grid settings')
  }
  if (!flowText.includes("const panelScale = computeWidgetScale(zoomK, null, { mode: 'floating' })")) {
    throw new Error('expected widget collision layout scale to keep floating-mode sizing path')
  }
  if (!flowText.includes('isFrontmatterFlow || widgetGrid.gridEnabled')) {
    throw new Error('expected widget dock layout to use centered grid strategy when toolbar grid is enabled')
  }
  if (!flowText.includes('snapToGridPx(') || !flowText.includes('snapScreen(')) {
    throw new Error('expected widget overlay positions to snap to toolbar grid increments')
  }
  if (!flowText.includes('const widgetGrid = readWidgetGridLayoutSettings(schema)')) {
    throw new Error('expected widget seeded world positions to use toolbar grid settings')
  }

  if (nodeText.includes('floatingDockRef')) {
    throw new Error('expected widget overlay to avoid right-edge floating dock ref behavior')
  }
  if (nodeText.includes("mode: 'right'")) {
    throw new Error('expected widget overlay to avoid right-edge auto-docking mode')
  }
}

export function testFlowEditorWidgetPinDescriptionsAreActionClear() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const panelText = readFileSync(panelPath, 'utf8')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')
  const copyText = readFileSync(copyPath, 'utf8')
  const labelsPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiMeta.ts')
  const labelsText = readFileSync(labelsPath, 'utf8')

  if (!panelText.includes('title={pinned ? UI_LABELS.unpinPanel : UI_LABELS.pinPanel}')) {
    throw new Error('expected widget pin button title to reflect explicit action for current state')
  }
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  if (!overlayText.includes('if (pinnedInCanvas) return')) {
    throw new Error('expected widget header drag to be disabled only when pinned and enabled when unpinned')
  }
  if (!labelsText.includes("pinPanel: 'Pin to canvas (no drag)'")) {
    throw new Error('expected widget pin label to clearly describe drag-disabled pinned behavior')
  }
  if (!labelsText.includes("unpinPanel: 'Unpin (drag enabled)'")) {
    throw new Error('expected widget unpin label to clearly describe drag-enabled behavior')
  }
  if (!copyText.includes("flowWidgetPin: 'Pin to canvas (follows canvas zoom/pan; drag disabled).'")) {
    throw new Error('expected widget pin tooltip copy to state zoom-follow with drag disabled')
  }
  if (!copyText.includes("flowWidgetUnpin: 'Unpin (follows canvas zoom/pan; drag enabled).'")) {
    throw new Error('expected widget unpin tooltip copy to state zoom-follow with drag enabled')
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
    throw new Error('expected overlay edge anchor position to clamp Y within widget bounds')
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
  const buildNativeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'buildNativeScene.ts')
  const buildNativeSceneText = readFileSync(buildNativeScenePath, 'utf8')
  const flowDataflowPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'flowDataflow.ts')
  const flowDataflowText = readFileSync(flowDataflowPath, 'utf8')
  const endpointHelperPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'edgeEndpoints.ts')
  const endpointHelperText = readFileSync(endpointHelperPath, 'utf8')

  if (!endpointHelperText.includes('export function readEdgeEndpointId')) {
    throw new Error('expected shared edge endpoint id resolver helper for object/string edge endpoint compatibility')
  }
  if (!portHandlesText.includes('readEdgeEndpointId(e?.source)') || !portHandlesText.includes('readEdgeEndpointId(e?.target)')) {
    throw new Error('expected widget port handle edge coercion to resolve object-form edge endpoints via shared helper')
  }
  if (!handlesText.includes('readEdgeEndpointId((e as { source?: unknown })?.source)')) {
    throw new Error('expected flow handle computation to resolve source endpoint ids via shared helper')
  }
  if (!handlesText.includes('readEdgeEndpointId((e as { target?: unknown })?.target)')) {
    throw new Error('expected flow handle computation to resolve target endpoint ids via shared helper')
  }
  if (!buildNativeSceneText.includes('const source = readEdgeEndpointId(e?.source)')) {
    throw new Error('expected flow native scene edge construction to resolve source endpoint ids via shared helper')
  }
  if (!buildNativeSceneText.includes('const target = readEdgeEndpointId(e?.target)')) {
    throw new Error('expected flow native scene edge construction to resolve target endpoint ids via shared helper')
  }
  if (!flowDataflowText.includes('readEdgeEndpointId((e as unknown as { source?: unknown })?.source)')) {
    throw new Error('expected flow dataflow connected-value pipeline to resolve source endpoint ids via shared helper')
  }
  if (!flowDataflowText.includes('readEdgeEndpointId((e as unknown as { target?: unknown })?.target)')) {
    throw new Error('expected flow dataflow connected-value pipeline to resolve target endpoint ids via shared helper')
  }
}

export function testFlowEditorWidgetOverlaysDefaultToFloatingBalancedZoomFollow() {
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const runtimeSceneText = readFileSync(runtimeScenePath, 'utf8')
  if (overlaySurfaceText.includes('forcePinnedToCanvas')) {
    throw new Error('expected FlowEditor overlay widgets to avoid legacy force-pinned canvas mode')
  }
  if (!runtimeSceneText.includes("return typeof v === 'boolean' ? v : false")) {
    throw new Error('expected zoom-follow pinned buckets to treat undefined pin state as floating by default')
  }
}

export function testFlowEditorPinnedWidgetForbidsAccidentalDuplicateCopy() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  if (!toolbarText.includes('duplicateDisabled: boolean')) {
    throw new Error('expected widget actions toolbar to accept duplicateDisabled guard for accidental copy prevention')
  }
  if (!toolbarText.includes('{!duplicateDisabled ? (')) {
    throw new Error('expected duplicate action to be removed when accidental-copy guard is active')
  }
  if (!overlayText.includes('duplicateDisabled={pinnedInCanvas}')) {
    throw new Error('expected duplicate guard to activate only for explicitly pinned widgets')
  }
  if (!overlaySurfaceText.includes('const pinned = pinnedMap[id] === true')) {
    throw new Error('expected widget duplicate callback to guard only explicit pinned state before copying')
  }
  if (!overlaySurfaceText.includes('Pinned widget blocks duplicate copy.')) {
    throw new Error('expected widget duplicate guard to notify user when copy is blocked in pinned mode')
  }
}
