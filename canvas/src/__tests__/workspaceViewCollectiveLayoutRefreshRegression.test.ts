import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
export function testWorkspaceViewUpdateSchedulesFlowEditorCollectiveCollisionRefresh() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts'); const text = readFileSync(p, 'utf8')
  const surfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx'); const surfaceText = readFileSync(surfacePath, 'utf8')
  if (text.includes('workspaceViewSig')) {
    throw new Error('expected Flow Editor collective collision key to avoid workspace view signature coupling')
  }
  if (text.includes('workspaceCanvasPaneOpen === true ? 1 : 0')) {
    throw new Error('expected Flow Editor collective collision refresh to avoid workspace pane open state coupling')
  }
  if (!text.includes('const workspaceOverlayOpenRef = React.useRef(false)')) {
    throw new Error('expected Flow Editor collective collision to track workspace overlay open state without key coupling')
  }
  if (!surfaceText.includes("import { isWorkspaceEditorOverlayOpen, isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor collective collision to reuse the shared workspace/indexing mutation guard')
  }
  if (!surfaceText.includes('const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))')) {
    throw new Error('expected Flow Editor collective collision to derive Workspace/Indexing mutation state via the shared guard')
  }
  if (!text.includes('if (workspaceOverlayOpenRef.current) return')) {
    throw new Error('expected workspace overlay open state to block persisted Flow Editor widget position mutation')
  }
  const mutationGuardIndex = text.indexOf('if (workspaceOverlayOpenRef.current) return')
  const writebackIndex = text.indexOf('st.setFlowWidgetPosByNodeId(nextPos)')
  if (mutationGuardIndex < 0 || writebackIndex < 0 || mutationGuardIndex > writebackIndex) {
    throw new Error('expected workspace overlay mutation guard before Flow Editor position writeback')
  }
  if (!text.includes('const unsubOpenWidgets = useGraphStore.subscribe(')) {
    throw new Error('expected Flow Editor collective collision to subscribe to open widget ids')
  }
  if (!text.includes('s.openWidgetNodeIds')) {
    throw new Error('expected Flow Editor collective collision refresh subscription to use openWidgetNodeIds')
  }
  const editorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const editorInnerPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const editorPlacementPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const editorViewPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx')
  const editorSharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'nodeOverlayEditorShared.ts')
  const editorWrapperText = readFileSync(editorPath, 'utf8')
  const editorText = [
    editorWrapperText,
    editorWrapperText.includes("from '@/components/FlowEditor/NodeOverlayEditorInner'") ? readFileSync(editorInnerPath, 'utf8') : '',
    readFileSync(editorPlacementPath, 'utf8'),
    readFileSync(editorViewPath, 'utf8'),
    readFileSync(editorSharedPath, 'utf8'),
  ].join('\n')
  if (!editorText.includes("import { isWorkspaceGraphMutationBlocked, type WorkspaceGraphMutationState } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected direct Flow Editor widget persistence to reuse the shared workspace/indexing mutation guard')
  }
  if (!editorText.includes('resolveFlowWidgetStateGraphKey')) {
    throw new Error('expected direct Flow Editor widget persistence to reuse shared graph semantic key helper for workspace-blocked in-memory updates')
  }
  if (!editorText.includes('if (isWorkspaceGraphMutationBlocked(state)) {')) {
    throw new Error('expected direct Flow Editor widget persistence to branch workspace-blocked updates through an explicit in-memory path')
  }
  if (!editorText.includes('interactionPassthrough?: boolean')) {
    throw new Error('expected NodeOverlayEditor to expose explicit interaction passthrough mode for workspace-open Flow Editor gesture routing')
  }
  if (!editorText.includes("data-kg-canvas-wheel-ignore={interactionPassthrough ? 'false' : 'true'}")) {
    throw new Error('expected NodeOverlayEditor workspace passthrough mode to stop marking overlay panels as canvas wheel-ignore surfaces')
  }
  if (!editorText.includes("className={interactionPassthrough ? 'fixed pointer-events-none' : 'fixed'}")) {
    throw new Error('expected NodeOverlayEditor workspace passthrough mode to forward pointer gestures to Flow canvas for collective drag/pan/zoom')
  }
  if (!editorText.includes("const passthroughPointerEventsClass = interactionPassthrough ? 'pointer-events-none' : 'pointer-events-auto'")) {
    throw new Error('expected NodeOverlayEditor workspace passthrough mode to centralize overlay panel/toolbar pointer-event routing')
  }
  if (!editorText.includes('className={passthroughPointerEventsClass}')) {
    throw new Error('expected NodeOverlayEditor workspace passthrough mode to disable panel pointer interactions so collective canvas gestures remain available')
  }
  if (!editorText.includes('if (interactionPassthrough) return')) {
    throw new Error('expected NodeOverlayEditor pointer capture handler to no-op in workspace passthrough mode')
  }
  const overlaySharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  const overlaySharedText = readFileSync(overlaySharedPath, 'utf8')
  if (!overlaySharedText.includes('interactionPassthrough?: boolean')) {
    throw new Error('expected FlowEditorWidgetOverlay shared wrapper to thread interaction passthrough contract into NodeOverlayEditor')
  }
  if (!overlaySharedText.includes('interactionPassthrough={args.interactionPassthrough}')) {
    throw new Error('expected FlowEditorWidgetOverlay shared wrapper to pass interaction passthrough into NodeOverlayEditor')
  }
  if (!editorText.includes('useGraphStore.setState(prev => {')) {
    throw new Error('expected direct Flow Editor widget persistence to update in-memory widget positions while workspace mutation is blocked')
  }
  if (!editorText.includes('flowWidgetPosByNodeIdByGraphMetaKey')) {
    throw new Error('expected direct Flow Editor screen-position in-memory updates to mirror graph-keyed SSOT while workspace mutation is blocked')
  }
  if (!editorText.includes('flowWidgetWorldPosByNodeIdByGraphMetaKey')) {
    throw new Error('expected direct Flow Editor world-position in-memory updates to mirror graph-keyed SSOT while workspace mutation is blocked')
  }
  if (!editorText.includes('state.setFlowWidgetPosByNodeId(next)')) {
    throw new Error('expected direct Flow Editor screen-position persistence path to remain available when workspace mutation is not blocked')
  }
  if (!editorText.includes('setFlowWidgetWorldPosByNodeId(next)')) {
    throw new Error('expected direct Flow Editor world-position persistence path to remain available when workspace mutation is not blocked')
  }
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowCanvasText = readFileSync(flowCanvasPath, 'utf8')
  const flowCanvasInteractionRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasInteractionRuntime.tsx')
  const flowCanvasInteractionRuntimeText = readFileSync(flowCanvasInteractionRuntimePath, 'utf8')
  if (!flowCanvasText.includes('allowLayoutCommitWhenWorkspaceBlocked: canvas2dRenderer === \'flowEditor\'')) {
    throw new Error('expected FlowCanvas commit path to allow Flow Editor layout commits while workspace view is open')
  }
  if (!flowCanvasText.includes('const WORKSPACE_PREINIT_DRAW_INTERACTION_BYPASS_MS = 1200')) {
    throw new Error('expected FlowCanvas pre-init draw suppression to include a bounded user-interaction bypass window for zoom/minimap responsiveness')
  }
  if (!flowCanvasText.includes('const interactedRecently = Date.now() - lastUserInteractionAtMsRef.current <= WORKSPACE_PREINIT_DRAW_INTERACTION_BYPASS_MS')
    || !flowCanvasText.includes('if (interactedRecently) return false')) {
    throw new Error('expected FlowCanvas pre-init draw suppression to bypass gating after recent user interaction so toolbar/minimap zoom requests are not dropped')
  }
  if (!flowCanvasText.includes('const scheduleFlowDraw = React.useCallback((opts?: { force?: boolean }) => {')
    || !flowCanvasText.includes('if (!force && shouldSuppressWorkspacePreInitCanvasDraw())')) {
    throw new Error('expected FlowCanvas draw scheduler to expose a force bypass path for interaction-driven zoom/minimap frames under pre-init suppression')
  }
  if (!flowCanvasInteractionRuntimeText.includes('scheduleFlowDraw({ force: true })')) {
    throw new Error('expected FlowCanvas interaction runtime zoom callback to force draw flush so toolbar/minimap zoom remains responsive during pre-init suppression')
  }
  if (!flowCanvasText.includes('width={canvasPixelW}') || !flowCanvasText.includes('height={canvasPixelH}')) {
    throw new Error('expected FlowCanvas to bind backing-store dimensions to viewport*dpr so first frame is sharp in workspace-open Flow Editor')
  }
  const flowCommitPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowRequestCommit.ts')
  const flowCommitText = readFileSync(flowCommitPath, 'utf8')
  if (!flowCommitText.includes('const allowLayoutCommit = !workspaceMutationBlocked || allowLayoutCommitWhenWorkspaceBlocked === true')) {
    throw new Error('expected FlowCanvas requestCommit to decouple workspace mutation guard from Flow Editor collective interaction commits')
  }
  if (!flowCommitText.includes('commitZoomTransformToStore({')) {
    throw new Error('expected FlowCanvas requestCommit to keep viewport zoom-state commit active during workspace-open interaction')
  }
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const overlayEdgesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const overlayEdgesText = readFileSync(overlayEdgesPath, 'utf8')
  const worldSeedGuardIndex = runtimeText.indexOf('if (workspaceMutationBlockedForSeed && !collectiveOutsideViewport && !hasMissingWorldSeeds && !hasDriftReseedCandidates) return')
  const worldSeedKeyWriteIndex = runtimeText.indexOf('seededPinnedWidgetWorldPosKeyRef.current = seedKey', worldSeedGuardIndex)
  const worldSeedWriteIndex = runtimeText.indexOf('st.setFlowWidgetWorldPosByNodeId(nextWorld)')
  if (worldSeedGuardIndex < 0 || worldSeedWriteIndex < 0 || worldSeedGuardIndex > worldSeedWriteIndex) {
    throw new Error('expected pinned widget auto-seed world-position persistence to stay blocked unless overlays are offscreen or missing seeds require first-frame recovery')
  }
  if (worldSeedKeyWriteIndex < 0 || worldSeedGuardIndex > worldSeedKeyWriteIndex || worldSeedKeyWriteIndex > worldSeedWriteIndex) {
    throw new Error('expected pinned widget auto-seed key to be committed only after Workspace/Indexing mutation guard')
  }
  if (!runtimeText.includes('const hasMissingWorldSeeds = pendingRaw.length > 0')) {
    throw new Error('expected pinned widget auto-seed guard to treat missing world seeds as a first-frame recovery exception')
  }
  if (!runtimeText.includes('const hasDriftReseedCandidates = overlapEligible.length > 0 || forceSceneEmptyReseed')) {
    throw new Error('expected pinned widget auto-seed guard to classify overlap/scene-empty recovery as drift reseed candidates')
  }
  if (!runtimeText.includes('if (workspaceMutationBlockedForSeed) {')) {
    throw new Error('expected pinned widget auto-seed to route workspace-blocked writes through an explicit in-memory branch')
  }
  if (!runtimeText.includes('flowWidgetWorldPosByNodeId: nextWorld')) {
    throw new Error('expected pinned widget auto-seed workspace-blocked branch to apply non-persistent in-memory world positions')
  }
  if (!runtimeText.includes('buildGraphMetaKeyIgnoringPending(graphDataForSeeding || prevState.graphData || null)')) {
    throw new Error('expected pinned widget auto-seed workspace-blocked branch to resolve active graph meta key for in-memory world SSOT sync')
  }
  if (!runtimeText.includes('flowWidgetWorldPosByNodeIdByGraphMetaKey: nextWorldByKey')) {
    throw new Error('expected pinned widget auto-seed workspace-blocked branch to update graph-keyed world SSOT in memory')
  }
  if (runtimeText.includes('const reseedEligible = effectiveOpenIds')) {
    throw new Error('expected pinned widget auto-seed to avoid reseeding already-placed world positions on layout-signature churn')
  }
  if (!runtimeText.includes('let pending = Array.from(new Set([...pendingRaw, ...overlapEligible])).sort((a, b) => a.localeCompare(b))')) {
    throw new Error('expected pinned widget auto-seed to only seed missing or overlapping world positions')
  }
  if (!runtimeText.includes("graphMetaKind === 'frontmatter-flow'\n            ? Object.keys(worldById)")) {
    throw new Error('expected pinned widget auto-seed to fallback to world-key ids when frontmatter effective-open ids are empty')
  }
  if (!runtimeText.includes('const shouldReseedWholeFrontmatterCollective =') || !runtimeText.includes('if (shouldReseedWholeFrontmatterCollective) pending = fullFrontmatterCollectiveIds')) {
    throw new Error('expected pinned widget auto-seed to force frontmatter offscreen pinned recovery when overlap/missing detection yields no pending ids')
  }
  if (!runtimeText.includes('const allowPersistedViewportOffsetSeed = !workspaceMutationBlockedForSeed')) {
    throw new Error('expected pinned widget auto-seed to disable persisted zoom-offset fallback while Workspace overlay/indexing mutation guard is active')
  }
  if (!runtimeText.includes('(allowPersistedViewportOffsetSeed && persistedHasViewportOffset && liveLooksDefault ? persistedZoom : null)')) {
    throw new Error('expected pinned widget auto-seed zoom source to gate persisted viewport-offset seed by workspace mutation guard')
  }
  if (!runtimeText.includes('const currentLayoutSignature = `${args.overlayTopologyLayoutSignature}|${visibleViewport.left},${visibleViewport.top},${visibleViewport.width}x${visibleViewport.height}|${bucketSignature}`')) {
    throw new Error('expected pinned widget auto-seed layout signature to include pane-aware visible viewport geometry so workspace-open reseeds cannot reuse full-surface signatures')
  }
  if (!runtimeText.includes('args.flowEditorSurfaceId,')) {
    throw new Error('expected Flow Editor runtime scene dependencies to react to surface-scoped visible viewport changes')
  }
  if (!runtimeText.includes('const shouldUseNeutralSeedZoom =')
    || !runtimeText.includes('runtimeSceneNodeCount <= 0')
    || !runtimeText.includes('|| shouldUseNeutralSeedZoomForFrontmatterInit')) {
    throw new Error('expected pinned widget auto-seed to neutralize stale zoom offset when flow runtime scene is empty')
  }
  if (!runtimeText.includes('(shouldUseNeutralSeedZoom ? { k: 1, x: 0, y: 0 } : null)')) {
    throw new Error('expected pinned widget auto-seed zoom source to prioritize neutral zoom for empty-scene overlay recovery')
  }
  if (!runtimeText.includes('const shouldUseNeutralSeedZoomForFrontmatterInit =')
    || !runtimeText.includes('const isFirstFrontmatterInitSeed = isFrontmatterFlow && seededPinnedWidgetWorldPosKeyRef.current.length === 0')
    || !runtimeText.includes('|| (isFrontmatterFlow && workspaceMutationBlockedForSeed)')) {
    throw new Error('expected frontmatter-flow init seeding to force neutral zoom on first seed pass when pending widget seeds exist, independent of stale live default checks')
  }
  if (!runtimeText.includes("reason: 'scene-empty-workspace-blocked-awaiting-live-transform'")) {
    throw new Error('expected pinned widget auto-seed to gate workspace-blocked empty-scene frontmatter placement until post-init layout')
  }
  if (!runtimeText.includes("const forceSceneEmptyReseed = runtimeSceneNodeCount <= 0 && graphMetaKind === 'frontmatter-flow'")) {
    throw new Error('expected pinned widget auto-seed to force full frontmatter pinned reseed when runtime scene is empty')
  }
  if (!runtimeText.includes('if (forceSceneEmptyReseed) return true')) {
    throw new Error('expected pinned widget auto-seed pending selection to include all pinned widgets during empty-scene reseed')
  }
  if (!runtimeText.includes('if (seededPinnedWidgetWorldPosKeyRef.current === seedKey && !collectiveOutsideViewport && !forceSceneEmptyReseed) return')) {
    throw new Error('expected pinned widget auto-seed key guard to allow forced scene-empty reseed despite matching seed key')
  }
  if (!runtimeText.includes("const FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY = '__flowEditorRuntimeSceneDebug'")) {
    throw new Error('expected runtime source instrumentation to expose deterministic transform-authority trace entries for Flow Editor overlay drift diagnostics')
  }
  if (!runtimeText.includes('const lastUsableZoomTransformRef = React.useRef<{ k: number; x: number; y: number } | null>(null)')) {
    throw new Error('expected runtime transform authority to persist last usable transform so empty-scene recomposition does not flash widgets offscreen')
  }
  if (!runtimeText.includes('const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))')) {
    throw new Error('expected Flow Editor runtime scene to subscribe to shared workspace mutation guard for open/close transition resets')
  }
  if (!runtimeText.includes('const workspaceMutationBlockedPrevRef = React.useRef<boolean>(workspaceMutationBlocked)')) {
    throw new Error('expected Flow Editor runtime scene to track workspace mutation transition edges for reopen reset logic')
  }
  if (!runtimeText.includes('if (workspaceMutationBlocked !== true || prev === true) return')) {
    throw new Error('expected Flow Editor runtime scene to run transition reset only on workspace reopen edges')
  }
  if (!runtimeText.includes("lastUsableZoomTransformRef.current = null")) {
    throw new Error('expected Flow Editor runtime scene to clear stale last-usable transform on workspace reopen to prevent far-right jump')
  }
  if (!runtimeText.includes("seededPinnedWidgetWorldPosKeyRef.current = ''") || !runtimeText.includes("lastAutoSeedLayoutSignatureRef.current = ''")) {
    throw new Error('expected Flow Editor runtime scene to clear transient auto-seed keys on workspace reopen so post-init layout reseed is authoritative')
  }
  if (!runtimeText.includes("reason: 'scene-empty-using-last-usable-transform'")) {
    throw new Error('expected runtime trace to report scene-empty fallback that reuses last usable transform instead of dropping overlays')
  }
  if (!runtimeText.includes("reason: 'scene-empty-using-persisted-transform'")) {
    throw new Error('expected runtime transform authority to fallback to persisted effective zoom before neutral identity during transient empty-scene frames')
  }
  if (!runtimeText.includes('persistedLooksSafeForWorkspaceBlocked')) {
    throw new Error('expected runtime transform authority to gate persisted empty-scene transform reuse by workspace-blocked viewport safety bounds')
  }
  if (!runtimeText.includes("reason: 'scene-empty-persisted-transform-rejected-workspace-blocked'")) {
    throw new Error('expected runtime trace to record rejected stale persisted transforms during workspace-blocked empty-scene windows')
  }
  if (!runtimeText.includes("reason: 'workspace-blocked-offscreen-transform-reusing-last-usable'")) {
    throw new Error('expected workspace-blocked offscreen transform guard to reuse last usable transform before neutral fallback')
  }
  if (!runtimeText.includes('lastUsableZoomTransformRef.current = next')) {
    throw new Error('expected runtime transform authority to refresh last usable transform from visible live transform frames')
  }
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const collisionText = readFileSync(collisionPath, 'utf8')
  if (!collisionText.includes("|| { k: 1, x: 0, y: 0 }")) {
    throw new Error('expected overlay collision node obstacle projection to avoid null transform fallthrough by using numeric identity fallback')
  }
  if (collisionText.includes('zoomStateByKey: st.zoomStateByKey }) || null')) {
    throw new Error('expected overlay collision node obstacle projection to forbid null transform fallback that can trigger number-null runtime warnings')
  }
  if (!runtimeText.includes('workspaceMutationBlocked && sceneNodeCount > 0')) {
    throw new Error('expected runtime transform authority to add workspace-mutation-blocked offscreen guards before reusing live transform for overlay seeding')
  }
  if (!runtimeText.includes('const interactionInProgress = Date.now() - lastInteractionFrameAtMsRef.current < 620')) {
    throw new Error('expected runtime transform authority to detect active flow-editor interaction frames before applying workspace-blocked offscreen transform guard')
  }
  if (!runtimeText.includes('const flowWidgetDraggingNodeId = String(useGraphStore.getState().flowWidgetDraggingNodeId || \'\').trim()')) {
    throw new Error('expected runtime transform authority to detect active widget dragging before applying workspace-blocked offscreen transform guard')
  }
  if (!runtimeText.includes('workspaceMutationBlocked && sceneNodeCount > 0 && !interactionInProgress && !flowWidgetDragging')) {
    throw new Error('expected runtime transform authority to defer workspace-blocked offscreen transform neutralization/reuse while user pan/zoom/drag interaction is in progress')
  }
  if (!runtimeText.includes('const allowPersistedDuringActiveInteraction = interactionInProgress || flowWidgetDragging')) {
    throw new Error('expected runtime scene-empty persisted-transform branch to allow active interaction to keep current transform in workspace mutation windows')
  }
  if (!runtimeText.includes('|| allowPersistedDuringActiveInteraction')) {
    throw new Error('expected runtime scene-empty persisted-transform reuse gate to include active interaction override')
  }
  if (!runtimeText.includes("reason: 'workspace-blocked-offscreen-transform-neutralized'")) {
    throw new Error('expected runtime transform trace to record when offscreen workspace-blocked transforms are neutralized to prevent flash-right drift')
  }
  if (!runtimeText.includes('return { k: 1, x: 0, y: 0 }')) {
    throw new Error('expected runtime transform guard to fall back to neutral transform when workspace-blocked live transform is offscreen')
  }
  if (!runtimeText.includes('isCanonicalFrontmatterBuiltInWidgetNode')) {
    throw new Error('expected pinned widget auto-seed overlap detection to include canonical frontmatter widget identity')
  }
  if (!runtimeText.includes("graphMetaKind === 'frontmatter-flow'")) {
    throw new Error('expected pinned widget auto-seed overlap detection to include frontmatter-flow pinned widgets with stale world positions')
  }
  if (!runtimeText.includes('&& !frontmatterPinnedWidget) continue')) {
    throw new Error('expected pinned widget auto-seed overlap detection to avoid skipping frontmatter pinned widgets when world positions exist')
  }

  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const renderStateText = readFileSync(renderStatePath, 'utf8')
  const graphStatePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const graphStateText = readFileSync(graphStatePath, 'utf8')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const overlaySurfaceVisibilityPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceVisibility.ts'); const flowEditorSurfaceVisibilityText = readFileSync(overlaySurfaceVisibilityPath, 'utf8')
  const runtimeCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const runtimeCanvasText = readFileSync(runtimeCanvasPath, 'utf8')
  if (!runtimeCanvasText.includes('workspaceMutationBlocked,') || !runtimeCanvasText.includes('useFlowEditorRenderState({')) {
    throw new Error('expected Flow Editor canvas runtime to pass shared workspace mutation-blocked state into render graph stabilization path')
  }
  if (!runtimeCanvasText.includes('workspaceMutationBlocked,')) {
    throw new Error('expected Flow Editor render state hook invocation to include workspace mutation-blocked input')
  }
  if (!renderStateText.includes('workspaceMutationBlocked: boolean')) {
    throw new Error('expected Flow Editor render state to accept shared workspace mutation-blocked state for transient render graph stability')
  }
  if (!renderStateText.includes('const shouldPreserveStableDuringWorkspaceMutation =')) {
    throw new Error('expected Flow Editor render state to centralize workspace-mutation transient empty-graph preservation guard')
  }
  if (!renderStateText.includes('if (shouldPreserveStableDuringWorkspaceMutation && prev?.documentKey === args.activeDocumentKey) return prev')) {
    throw new Error('expected Flow Editor render state stable graph cache writes to avoid replacing stable graph with transient empty graph during workspace mutation windows')
  }
  if (!renderStateText.includes('const preserveStableGraphDuringWorkspaceMutation =')) {
    throw new Error('expected Flow Editor render state graph selection to prefer stable graph during workspace-mutation transient empty-graph frames')
  }
  if (!renderStateText.includes('if (preserveStableGraphDuringWorkspaceMutation) return stableGraph')) {
    throw new Error('expected Flow Editor render state graph selection to keep overlays mounted without close/reopen when workspace mutation emits empty render graph frames')
  }
  if (!renderStateText.includes('const preserveStableGraphAcrossFlowViewClose =')) {
    throw new Error('expected Flow Editor render state to name the stable graph reuse contract for workspace close explicitly')
  }
  if (!graphStateText.includes('const allowMutations = allowNodeDragOverride !== false')) {
    throw new Error('expected FlowCanvas graph state to keep interaction mutation pathways enabled in Workspace-open Flow Editor mode')
  }
  if (graphStateText.includes('allowNodeDragOverride !== false && documentStructureBaselineLock !== true')) {
    throw new Error('expected FlowCanvas interaction mutation gate to avoid baseline-lock coupling that freezes workspace-open drag/pan/zoom')
  }
  if (!flowEditorSurfaceVisibilityText.includes('if (workspaceMutationBlocked) {')) {
    throw new Error('expected Flow Editor overlay-only mode to keep base FlowCanvas visible while workspace mutation/view is active')
  }
  if (!flowEditorSurfaceVisibilityText.includes('return false')) {
    throw new Error('expected workspace-mutation overlay-only guard to explicitly preserve base canvas interaction and edge visibility')
  }
  if (overlaySurfaceText.includes('preferCanvasCollectiveInteraction')) {
    throw new Error('expected Flow Editor overlay surface to avoid base FlowCanvas collective fallback authority that can cause renderer seepage/interference')
  }
  const overlayCanvasSurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'FlowEditorCanvasSurface.tsx')
  const overlayCanvasSurfaceText = readFileSync(overlayCanvasSurfacePath, 'utf8')
  if (!overlayCanvasSurfaceText.includes('renderNodes={true}')) {
    throw new Error('expected Flow Editor canvas surface to keep runtime scene nodes active for collective drag/pan/zoom while overlay-only mode is enabled')
  }
  if (overlayCanvasSurfaceText.includes('hideNodeIds=')) {
    throw new Error('expected Flow Editor canvas surface to forbid hideNodeIds masking and keep FlowCanvas visibility neutral')
  }
  if (overlayCanvasSurfaceText.includes('hidePortHandleNodeIds=')) {
    throw new Error('expected Flow Editor canvas surface to forbid hidePortHandleNodeIds masking and keep FlowCanvas interaction contracts upstream')
  }
  if (!overlaySurfaceText.includes('const overlayExcludedNodeIds = overlayOnlyActive ? overlayEditorNodeIdsSnapshot : []')) {
    throw new Error('expected Flow Editor overlay surface to neutralize seepage via upstream filtered graph exclusions instead of FlowCanvas hide props')
  }
  if (!overlaySurfaceText.includes('return filterGraphByExcludedNodeIds({')) {
    throw new Error('expected Flow Editor overlay surface to centralize overlay/base isolation in shared graph exclusion helper')
  }
  const flowEditorCanvasRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const flowEditorCanvasRuntimeText = readFileSync(flowEditorCanvasRuntimePath, 'utf8')
  if (!flowEditorCanvasRuntimeText.includes('renderGraphDataOverride={flowCanvasGraphDataOverride}')) {
    throw new Error('expected Flow Editor runtime to pass the upstream-filtered graph override into FlowCanvas')
  }
  if (!renderStateText.includes('prev.topologyLayoutSignature === nextTopologyLayoutSignature')) {
    throw new Error('expected Flow Editor render state to preserve the stable overlay graph only when semantic overlay topology still matches')
  }
  if (!renderStateText.includes('if (preserveStableGraphAcrossFlowViewClose) return stableGraph')) {
    throw new Error('expected Flow Editor render state to reuse the last stable overlay graph during workspace close when topology is unchanged')
  }
  const graphDataSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataCommitActions.ts')
  const graphDataSliceText = readFileSync(graphDataSlicePath, 'utf8')
  if (!graphDataSliceText.includes("import { buildCanonicalNodeLookup, parseCanonicalNodeIds, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected graph commit carry-forward path to reuse shared canonical node identity helpers for workspace-prefixed graph clones')
  }
  if (!graphDataSliceText.includes('function remapNodeKeyedRecordByCanonicalNodeId<T>(')) {
    throw new Error('expected graph commit carry-forward path to centralize canonical remapping for node-keyed overlay state')
  }
  if (!graphDataSliceText.includes('readCanonicalGraphIdentity(n?.id)')) {
    throw new Error('expected same-source graph topology checks to compare canonical node ids instead of raw workspace-prefixed ids')
  }
  if (!graphDataSliceText.includes("`${readCanonicalGraphIdentity(e?.id)}|${readCanonicalGraphIdentity(e?.source)}|${readCanonicalGraphIdentity(e?.target)}`")) {
    throw new Error('expected same-source graph topology checks to compare canonical edge identities instead of raw workspace-prefixed ids')
  }
  if (!graphDataSliceText.includes('remapNodeKeyedRecordByCanonicalNodeId(nextGraphData, { ...(s.flowWidgetPosByNodeId || {}) })')) {
    throw new Error('expected graph commit carry-forward path to remap stored Flow widget screen positions onto canonical next-graph ids')
  }
  if (!graphDataSliceText.includes('remapNodeKeyedRecordByCanonicalNodeId(nextGraphData, { ...(s.flowWidgetWorldPosByNodeId || {}) })')) {
    throw new Error('expected graph commit carry-forward path to remap stored Flow widget world positions onto canonical next-graph ids')
  }
  const storePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphViewSlice.ts')
  const storeText = readFileSync(storePath, 'utf8')
  if (!storeText.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow widget store setters to reuse the shared workspace/indexing mutation guard')
  }
  const storePinnedGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(state)) return')
  const storePinnedWriteIndex = storeText.indexOf('scheduleFlowWidgetPersistence({ pinned: { graphKey, value: nextPinnedById } })')
  if (storePinnedGuardIndex < 0 || storePinnedWriteIndex < 0 || storePinnedGuardIndex > storePinnedWriteIndex) {
    throw new Error('expected root Flow widget pinned-state setter to reject Workspace/Indexing mutation writes')
  }
  const storeScreenGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(state)) return', storePinnedGuardIndex + 1)
  const storeScreenWriteIndex = storeText.indexOf('scheduleFlowWidgetPersistence({ pos: { graphKey, value: nextPosByNodeId } })')
  if (storeScreenGuardIndex < 0 || storeScreenWriteIndex < 0 || storeScreenGuardIndex > storeScreenWriteIndex) {
    throw new Error('expected root Flow widget screen-position setter to reject Workspace/Indexing mutation writes')
  }
  const storeWorldGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(state)) return', storeScreenGuardIndex + 1)
  const storeWorldWriteIndex = storeText.indexOf('scheduleFlowWidgetPersistence({ world: { graphKey, value: nextWorldByNodeId } })')
  if (storeWorldGuardIndex < 0 || storeWorldWriteIndex < 0 || storeWorldGuardIndex > storeWorldWriteIndex) {
    throw new Error('expected root Flow widget world-position setter to reject Workspace/Indexing mutation writes')
  }
  if (!overlayEdgesText.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor overlay edge scheduler to reuse the shared workspace/indexing mutation guard')
  }
  if (!overlayEdgesText.includes('const workspaceOverlayOpenRef = React.useRef(false)')) {
    throw new Error('expected Flow Editor overlay edge scheduler to keep workspace overlay-open state as a latest-value guard')
  }
  if (!overlayEdgesText.includes('if (workspaceOverlayOpenRef.current) scheduleOverlayEdgeUpdate()')) {
    throw new Error('expected workspace overlay open initialization to redraw stable edge geometry instead of only cancelling queued recomputation')
  }
  if (!overlayEdgesText.includes("const FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR = 'data-kg-overlay-edge-id'")) {
    throw new Error('expected Flow Editor overlay edges to mark a canonical DOM edge identity for frozen-workspace reuse')
  }
  if (!overlayEdgesText.includes('const frozenOverlayEdgePathsBySurfaceId = new Map<string, FrozenOverlayEdgePathSnapshot[]>()')) {
    throw new Error('expected Flow Editor overlay edges to cache the last stable edge render by surface id')
  }
  if (!overlayEdgesText.includes('const cacheFrozenOverlayEdgePaths = React.useCallback(() => {')) {
    throw new Error('expected Flow Editor overlay edges to snapshot the last stable edge DOM before workspace-open freezes')
  }
  if (!overlayEdgesText.includes('const restoreFrozenOverlayEdgePaths = React.useCallback((svg: SVGSVGElement | null): number => {')) {
    throw new Error('expected Flow Editor overlay edges to restore frozen edge DOM while workspace-open recomputation is blocked')
  }
  if (!overlayEdgesText.includes('if (wasOpen) {') || !overlayEdgesText.includes('scheduleOverlayEdgeUpdate()')) {
    throw new Error('expected workspace overlay close transition to reschedule overlay edge recomputation')
  }
  const edgeScheduleGuardIndex = overlayEdgesText.indexOf('const workspaceOverlayOpen = workspaceOverlayOpenRef.current')
  const edgePathWriteIndex = overlayEdgesText.indexOf("if (pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d)")
  if (edgeScheduleGuardIndex < 0 || edgePathWriteIndex < 0 || edgeScheduleGuardIndex > edgePathWriteIndex) {
    throw new Error('expected Flow Editor overlay edge DOM writes to remain driven by the workspace-open guard and stable graph branch')
  }
  if (text.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Flow Editor collective collision signature to avoid workspace layout refresh nonce coupling')
  }
}

export function testWorkspaceViewUpdatePreservesFrozenOverlayEdgesWhileIndexingToastIsVisible() {
  const overlayEdgesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const text = readFileSync(overlayEdgesPath, 'utf8')
  if (!text.includes("const FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR = 'data-kg-overlay-edge-id'")) {
    throw new Error('expected overlay edge freeze preservation to use a canonical DOM edge identity')
  }
  if (!text.includes('const frozenOverlayEdgePathsBySurfaceId = new Map<string, FrozenOverlayEdgePathSnapshot[]>()')) {
    throw new Error('expected overlay edge freeze preservation to cache stable paths per surface')
  }
  if (!text.includes('const existingDomPaths = Array.from(svg.querySelectorAll(`path[${FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR}]`))')) {
    throw new Error('expected overlay edge restoration to rehydrate from already-mounted DOM paths before snapshot replay')
  }
  if (!text.includes('overlayEdgePathByIdRef.current.clear()')) {
    throw new Error('expected overlay edge restoration to rebuild the in-memory edge map from canonical DOM paths')
  }
  if (!text.includes("const snapshots = surfaceId ? frozenOverlayEdgePathsBySurfaceId.get(surfaceId) || [] : []")) {
    throw new Error('expected overlay edge restoration to fall back to the last stable per-surface snapshot')
  }
  if (!text.includes("pathEl.setAttribute(FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR, edgeId)")) {
    throw new Error('expected overlay edge writes to stamp canonical DOM edge ids onto live paths')
  }
  const workspaceStableGeometryIndex = text.indexOf("pushOverlayEdgeTrace('schedule-workspace-open-live-geometry', {")
  const workspaceStableGraphIndex = text.indexOf('const graph = shouldReuseStableGraph ? stableGraph : liveGraph')
  if (workspaceStableGeometryIndex < 0 || workspaceStableGraphIndex < 0 || workspaceStableGraphIndex > workspaceStableGeometryIndex) {
    throw new Error('expected workspace-open edge scheduling to reuse the last stable graph while redrawing against current live overlay geometry')
  }
  const svgAttachedClearIndex = text.indexOf('if (workspaceOverlayOpenRef.current) {')
  const svgAttachedRestoreIndex = text.indexOf('const restoredFrozenPathCount = workspaceOverlayOpenRef.current ? 0 : restoreFrozenOverlayEdgePaths(node)')
  const svgAttachedTraceIndex = text.indexOf("pushOverlayEdgeTrace('svg-attached', {")
  if (svgAttachedClearIndex < 0 || svgAttachedRestoreIndex < 0 || svgAttachedTraceIndex < 0 || svgAttachedClearIndex > svgAttachedRestoreIndex || svgAttachedRestoreIndex > svgAttachedTraceIndex) {
    throw new Error('expected overlay svg attachment to clear stale workspace-open edge paths and skip frozen path restoration before reporting attachment state')
  }
  const workspaceSkipIndex = text.indexOf("pushOverlayEdgeTrace('schedule-skip-workspace-open', {")
  const workspaceSkipClearIndex = text.indexOf('removeAllPaths(overlayEdgePathByIdRef)')
  if (workspaceSkipIndex < 0 || workspaceSkipClearIndex < 0 || workspaceSkipClearIndex > workspaceSkipIndex) {
    throw new Error('expected workspace-open edge scheduling without live geometry to clear stale paths before skipping redraw')
  }
}

export function testWorkspaceViewUpdateSchedulesFrontmatterMediaOverlayLayoutRefresh() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const text = readFileSync(p, 'utf8')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const commitPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowRequestCommit.ts')
  const commitText = readFileSync(commitPath, 'utf8')
  const computedPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowComputedPositions.ts')
  const computedText = readFileSync(computedPath, 'utf8')
  if (text.includes('const workspaceViewSig =')) {
    throw new Error('expected FlowCanvas media overlays to avoid deriving workspace view signature')
  }
  if (!text.includes('mediaOverlayLayoutScheduleRef.current?.()')) {
    throw new Error('expected FlowCanvas media overlays to schedule layout updates')
  }
  if (!text.includes('plannedOverlayNodeIdsKey')) {
    throw new Error('expected FlowCanvas media overlay layout scheduling to track planned overlay ids')
  }
  if (!text.includes('mediaLayoutItemIdsKey')) {
    throw new Error('expected FlowCanvas media overlay layout scheduling to track media overlay item ids')
  }
  if (!text.includes('flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlay loop dependencies to include frontmatter document mode')
  }
  if (!text.includes('const stopPassiveLayoutWhileWorkspaceOverlayOpen =\n      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected frontmatter media overlay refresh to derive a workspace-open passive-layout exception from frontmatter document mode')
  }
  const flowZoomCommitWriteIndex = commitText.indexOf('commitZoomTransformToStore({')
  const flowLayoutCommitGuardIndex = commitText.indexOf('if (!allowLayoutCommit) return')
  if (flowZoomCommitWriteIndex < 0) {
    throw new Error('expected Flow request commit to keep viewport zoom persistence active')
  }
  if (flowLayoutCommitGuardIndex < 0 || flowZoomCommitWriteIndex > flowLayoutCommitGuardIndex) {
    throw new Error('expected Flow request commit to gate layout persistence separately from zoom persistence while Workspace/Indexing mutation guard is active')
  }
  if (!runtimeText.includes('const lateFlowEditorInitAfterSceneBuild =')) {
    throw new Error('expected Flow runtime to name the late Flow Editor init guard explicitly')
  }
  if (!runtimeText.includes('const initialW = Math.max(1, Math.floor(viewportW * dpr))')
    || !runtimeText.includes('const initialH = Math.max(1, Math.floor(viewportH * dpr))')) {
    throw new Error('expected Flow runtime to prime canvas backing-store size before first draw for workspace-open sharpness')
  }
  if (!runtimeText.includes('lastBuiltGraphKeyRef.current.length > 0')) {
    throw new Error('expected Flow runtime late init guard to detect scene builds that raced ahead of zoom-key initialization')
  }
  if (!runtimeText.includes('Continue into fit so the first visible frame does not stay frozen at identity.')) {
    throw new Error('expected Flow runtime late init guard to continue into fit instead of freezing Flow Editor at identity')
  }
  if (runtimeText.includes('const graphKey = `${graphDataRevision}:')) {
    throw new Error('expected Flow runtime scene rebuild key to avoid raw graphDataRevision churn')
  }
  if (!runtimeText.includes('const graphKey = `${buildGraphMetaKeyIgnoringPending(sceneGraphData)}:')) {
    throw new Error('expected Flow runtime scene rebuild key to reuse semantic graph identity')
  }
  if (!runtimeText.includes("import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'")) {
    throw new Error('expected Flow runtime zoom seeding to reuse the shared flow transform visibility guard helper')
  }
  if (!runtimeText.includes('cancelFlowZoomRequestAnim(runtime)')) {
    throw new Error('expected Flow runtime authoritative fit/recovery writes to cancel stale zoom-request animations before applying transforms')
  }
  if (!runtimeText.includes('const preserveCurrentTransform =')) {
    throw new Error('expected Flow runtime zoom seeding to centralize stale offscreen transform preservation checks')
  }
  if (!runtimeText.includes('!isFlowEditor ||') || !runtimeText.includes('isFlowTransformShowingGraph(')) {
    throw new Error('expected Flow Editor zoom seeding to preserve non-identity transforms only when the current transform still shows graph content')
  }
  if (!runtimeText.includes('const initialTransformUsable = isUsableFlowTransform(initial)')) {
    throw new Error('expected Flow runtime zoom seeding to reject stale offscreen initial transforms in Flow Editor mode')
  }
  if (!runtimeText.includes('const shouldUseInitialTransform = workspaceEditorOverlayOpen !== true && initialTransformUsable')) {
    throw new Error('expected Flow runtime to disable stale stored initial transform reuse while Workspace overlay is open')
  }
  if (!runtimeText.includes('const seed = (shouldUseInitialTransform ? initial : null)')) {
    throw new Error('expected Flow runtime zoom seeding to fallback from unusable initial transforms to fit/current guard path')
  }
  if (!runtimeText.includes('if (isFlowEditor && alreadyInitializedForKey && workspaceEditorOverlayOpen !== true) return')) {
    throw new Error('expected Flow runtime initialization to re-evaluate fit while Workspace overlay is open instead of short-circuiting after first init key hit')
  }
  if (!runtimeText.includes('workspaceEditorOverlayOpen !== true')
    || !runtimeText.includes('Date.now() - lastUserInteractionAtMsRef.current < 500')) {
    throw new Error('expected Flow runtime to bypass recent-interaction init-fit suppression while Workspace overlay is open')
  }
  if (!runtimeText.includes('&& (workspaceOverlayStabilizedRef.current || workspaceOverlayUserControlledRef.current)')) {
    throw new Error('expected Flow runtime workspace-open init-fit freeze to activate only after transform authority is stabilized or user-controlled')
  }
  if (!runtimeText.includes('const hasCollectiveFlowWidgets = isFlowEditor && Array.isArray(openWidgetNodeIds) && openWidgetNodeIds.length > 0')) {
    throw new Error('expected Flow runtime init fit strategy to detect collective Flow Editor widget overlays before selecting centered-fit mode')
  }
  if (!runtimeText.includes('const canUseFrontmatterCollectiveInitFit =')
    || !runtimeText.includes("String(initFitGraphMeta.kind || '').trim() === 'frontmatter-flow'")
    || !runtimeText.includes("initFitGraphContext === 'frontmatter-flow'")
    || !runtimeText.includes('const canUseCollectiveInitFit = hasCollectiveFlowWidgets || canUseFrontmatterCollectiveInitFit')
    || !runtimeText.includes('!canUseCollectiveInitFit')
    || !runtimeText.includes('!canUseFrontmatterCollectiveInitFit')
    || !runtimeText.includes('&& hasCollectiveFlowWidgets')
    || !runtimeText.includes('&& !hasUsableCollectiveWidgetWorldPos')) {
    throw new Error('expected Flow runtime settled init fit to keep frontmatter-flow on the collective overlay fit path even before explicit open widget ids are populated')
  }
  if (!runtimeText.includes('x: fit.x + (useD3StyleInitFit ? 0 : visibleViewportFit.left),')) {
    throw new Error('expected Flow Editor fit seed to avoid x viewport offset when Workspace overlay D3-style init fit is active')
  }
  if (!runtimeText.includes('y: fit.y + (useD3StyleInitFit ? 0 : visibleViewportFit.top),')) {
    throw new Error('expected Flow Editor fit seed to avoid y viewport offset when Workspace overlay D3-style init fit is active')
  }
  if (!runtimeText.includes('const lastOffscreenOverlayRecoveryKeyRef = React.useRef<string | null>(null)')) {
    throw new Error('expected Flow runtime to track one-shot offscreen recovery while Workspace overlay is open')
  }
  if (!runtimeText.includes('const workspaceEditorOverlayOpen = useGraphStore(s => isWorkspaceEditorOverlayOpen(s))')) {
    throw new Error('expected Flow runtime to subscribe to shared Workspace overlay-open SSOT for deterministic open/close recovery passes')
  }
  if (!runtimeText.includes('const graphVisible = isFlowTransformShowingGraph(')) {
    throw new Error('expected Flow runtime to detect stale offscreen transforms before enforcing overlay recovery fit')
  }
  if (!runtimeText.includes('const buildSceneViewportRecoverySignature = React.useCallback((scene: FlowNativeRuntime[\'scene\'] | null): string => {')) {
    throw new Error('expected Flow runtime offscreen recovery to derive a semantic scene viewport signature from live scene coordinates')
  }
  if (!runtimeText.includes('const remapTransformToVisibleViewport = React.useCallback(')) {
    throw new Error('expected Flow runtime to normalize transform visibility checks into visible-viewport-local coordinates')
  }
  if (!runtimeText.includes('syncFlowCanvasDebugToast({ enabled: true })')) {
    throw new Error('expected Flow runtime recovery path to publish temporary debug status via toast SSOT')
  }
  if (!runtimeText.includes('x: t.x - visibleViewport.left,')) {
    throw new Error('expected Flow runtime transform normalization to offset x by visible viewport left before visibility checks')
  }
  if (!runtimeText.includes('y: t.y - visibleViewport.top,')) {
    throw new Error('expected Flow runtime transform normalization to offset y by visible viewport top before visibility checks')
  }
  if (!runtimeText.includes("import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'")) {
    throw new Error('expected Flow runtime offscreen recovery to reuse shared Flow Editor interaction-frame event contract')
  }
  if (!runtimeText.includes("import { isHorizontalOverlayStrip, isVerticalOverlayCluster } from '@/lib/ui/overlayBalancedSpread'")) {
    throw new Error('expected Flow runtime offscreen recovery to reuse shared balanced-spread strip/cluster detectors')
  }
  if (!runtimeText.includes('const [workspaceOverlayInteractionFrameTick, setWorkspaceOverlayInteractionFrameTick] = React.useState(0)')) {
    throw new Error('expected Flow runtime offscreen recovery to track interaction-frame ticks while Workspace overlay is open')
  }
  if (!runtimeText.includes('window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame)')) {
    throw new Error('expected Flow runtime offscreen recovery to subscribe to live Flow Editor interaction frames')
  }
  if (!runtimeText.includes('workspaceEditorOverlayOpen !== true &&')) {
    throw new Error('expected Flow runtime init preserve-current-transform guard to disable stale transform reuse while Workspace overlay is open')
  }
  if (!runtimeText.includes('const normalizedCurrent = remapTransformToVisibleViewport(')) {
    throw new Error('expected Flow runtime offscreen recovery visibility checks to evaluate normalized current transform within visible viewport coordinates')
  }
  if (!runtimeText.includes('const graphBalanced = isFlowTransformBalancedCollective({')) {
    throw new Error('expected Flow runtime offscreen recovery to detect visible-but-unbalanced collective layouts before skipping refit')
  }
  if (!runtimeText.includes('const transformDriftedFromFit =')) {
    throw new Error('expected Flow runtime offscreen recovery to detect visible-but-drifted transforms relative to current viewport fit')
  }
  if (!runtimeText.includes('if (graphVisible && graphBalanced && !transformDriftedFromFit) {')) {
    throw new Error('expected Flow runtime offscreen recovery to force refit when transform drifts from viewport fit even if graph remains visible')
  }
  if (!runtimeText.includes('const shouldIgnorePersistedWorldPosForWorkspaceOverlay = React.useMemo(() => {')) {
    throw new Error('expected Flow runtime fit path to guard against stale persisted world positions while Workspace overlay is open')
  }
  if (!runtimeText.includes("return kind === 'frontmatter-flow'")) {
    throw new Error('expected Flow runtime fit path to ignore persisted world positions for Workspace-open frontmatter-flow view switching')
  }
  if (!runtimeText.includes('worldPosById: fitWorldPosById,') && !runtimeText.includes('worldPosByNodeId: fitWorldPosById,')) {
    throw new Error('expected Flow runtime fit path to route overlay-open fit through sanitized world positions')
  }
  if (!runtimeText.includes('const allowOverlayCentroidRecovery = !overlayOpen && (!scene || scene.nodes.length === 0)')) {
    throw new Error('expected overlay centroid recovery to stay disabled while Workspace overlay is open and only run during pre-scene bootstrap without overlay')
  }
  if (!runtimeText.includes('if (!overlayOpen) {\n      lastOffscreenOverlayRecoveryKeyRef.current = null\n      return\n    }')) {
    throw new Error('expected Flow runtime to clear stale offscreen recovery latches when Workspace overlay closes')
  }
  if (!runtimeText.includes('const sceneViewportSignature = buildSceneViewportRecoverySignature(scene)')) {
    throw new Error('expected Flow runtime offscreen recovery key to include live scene viewport signature')
  }
  if (!runtimeText.includes('const currentTransformSignature = `${Math.round(current.x)}:${Math.round(current.y)}:${Math.round(current.k * 1000)}`')) {
    throw new Error('expected Flow runtime offscreen recovery key to include live transform signature so stale transform re-applies cannot block corrective refits')
  }
  if (!runtimeText.includes('const recoveryKey = `${graphKey}:${fitW}:${fitH}:${Math.round(visibleViewport.left)}:${Math.round(visibleViewport.top)}:${sceneViewportSignature}:${currentTransformSignature}`')) {
    throw new Error('expected Flow runtime offscreen recovery key to avoid coarse graph-only keying and include current transform signature')
  }
  if (!runtimeText.includes('workspaceOverlayInteractionFrameTick,')) {
    throw new Error('expected Flow runtime offscreen recovery effect dependencies to rerun on live interaction frames while Workspace overlay is open')
  }
  if (!runtimeText.includes('const interactionInProgress = interactionRecentMs < 520')) {
    throw new Error('expected Flow runtime offscreen recovery to derive a shared recent-interaction guard before applying corrective fit')
  }
  if (!runtimeText.includes('const flowWidgetDraggingNodeId = String(useGraphStore.getState().flowWidgetDraggingNodeId || \'\').trim()')) {
    throw new Error('expected Flow runtime offscreen recovery to detect active Flow widget drag state via shared store SSOT')
  }
  if (!runtimeText.includes('if (interactionInProgress || flowWidgetDragging) return')) {
    throw new Error('expected Flow runtime offscreen recovery to defer corrective fit while user pan/zoom/drag interaction is active, including workspace-open mode')
  }
  if (!runtimeText.includes('if (workspaceEditorOverlayOpen && graphVisible && graphBalanced) {')) {
    throw new Error('expected Flow runtime workspace-open recovery to preserve only already-balanced visible transforms')
  }
  if (!runtimeText.includes('const workspaceOverlayStabilizedRef = React.useRef(false)')) {
    throw new Error('expected Flow runtime workspace-open recovery to track stabilized transform authority after THEN-layout convergence')
  }
  if (!runtimeText.includes('const workspaceOverlayZoomViewKeyRef = React.useRef<string | null>(null)')) {
    throw new Error('expected Flow runtime workspace-open recovery to track active zoom view key for transform-authority resets')
  }
  if (!runtimeText.includes('const workspaceVisibleViewportSignatureRef = React.useRef<string | null>(null)')
    || !runtimeText.includes('const workspaceVisibleViewportStableTicksRef = React.useRef(0)')) {
    throw new Error('expected Flow runtime workspace-open recovery to track visible viewport stability before applying fit/recovery transforms')
  }
  if (!runtimeText.includes('const isWorkspaceVisibleViewportSettled = React.useCallback((visibleViewport: {')
    || !runtimeText.includes('workspaceVisibleViewportStableTicksRef.current >= 1')) {
    throw new Error('expected Flow runtime workspace-open recovery to gate transform writes on settled pane-aware viewport bounds')
  }
  if (!runtimeText.includes('const shouldDeferWorkspaceOpenDraw = React.useCallback((): boolean => {')
    || !runtimeText.includes('workspace-open-first-draw-deferred-unsettled-viewport')) {
    throw new Error('expected Flow runtime workspace-open scene draw to defer first paint while pane-aware viewport is unsettled to avoid flash')
  }
  if (!runtimeText.includes('const workspaceDeferredDrawPendingRef = React.useRef(false)')
    || !runtimeText.includes('workspaceDeferredDrawPendingRef.current = true')) {
    throw new Error('expected Flow runtime workspace-open draw deferral to track pending draw flush state while viewport settles')
  }
  if (!runtimeText.includes('const workspaceViewportSettleRetryTimeoutRef = React.useRef<number | null>(null)')
    || !runtimeText.includes('const scheduleWorkspaceViewportSettleRetry = React.useCallback(() => {')) {
    throw new Error('expected Flow runtime workspace-open init to keep a bounded viewport-settle retry scheduler so pre-init suppression does not stall until user interaction')
  }
  if (!runtimeText.includes('workspace-open-init-viewport-settle-retry-pending')
    || !runtimeText.includes('scheduleWorkspaceViewportSettleRetry()')) {
    throw new Error('expected Flow runtime workspace-open init path to emit deterministic retry reason and schedule a settle retry tick when viewport is not yet stable')
  }
  if (!runtimeText.includes('const provisionalUseD3StyleInitFit =')
    || !runtimeText.includes('const provisionalCanUseFrontmatterCollectiveInitFit =')
    || !runtimeText.includes("String(provisionalFitGraphMeta.kind || '').trim() === 'frontmatter-flow'")
    || !runtimeText.includes("provisionalFitGraphContext === 'frontmatter-flow'")
    || !runtimeText.includes('const provisionalCanUseCollectiveInitFit =')
    || !runtimeText.includes('!provisionalCanUseCollectiveInitFit')
    || !runtimeText.includes('!provisionalCanUseFrontmatterCollectiveInitFit')
    || !runtimeText.includes('&& provisionalHasCollectiveFlowWidgets')
    || !runtimeText.includes('&& !provisionalHasUsableCollectiveWidgetWorldPos')
    || !runtimeText.includes('const provisionalFit = provisionalUseD3StyleInitFit')
    || !runtimeText.includes(': fitFlowEditorPinnedWidgets({')
    || !runtimeText.includes('provisionalFit.x + (provisionalUseD3StyleInitFit ? 0 : visibleViewportFit.left)')
    || !runtimeText.includes('provisionalFit.y + (provisionalUseD3StyleInitFit ? 0 : visibleViewportFit.top)')) {
    throw new Error('expected Flow runtime provisional workspace-open init fit to keep frontmatter-flow on the collective overlay fit path and reuse pinned-widget fitting with visible-viewport offsets before explicit open widget ids are populated')
  }
  if (!runtimeText.includes('if (!workspaceDeferredDrawPendingRef.current) return')
    || !runtimeText.includes('workspaceOverlayInteractionFrameTick')) {
    throw new Error('expected Flow runtime workspace-open deferred first draw to flush once viewport settles on subsequent interaction/frame ticks')
  }
  if (!runtimeText.includes('const shouldSuppressWorkspacePreInitDraw = React.useCallback((): boolean => {')
    || !runtimeText.includes('workspace-open-preinit-draw-suppressed')) {
    throw new Error('expected Flow runtime workspace-open draw paths to suppress pre-init scene draws until the current zoom view key transform is initialized')
  }
  if (!runtimeText.includes('const frontmatterDocumentModeRequested = isFlowEditorFrontmatterDocumentModeRequested({')
    || !runtimeText.includes('if (hasRenderableGraphNodes && !frontmatterDocumentModeRequested) return false')) {
    throw new Error('expected Flow runtime workspace-open pre-init draw suppression to keep Flow Editor frontmatter document mode off the generic renderable-graph early-draw path')
  }
  if (!runtimeText.includes('if (lastInitTransformZoomViewKeyRef.current !== zoomViewKey) return')) {
    throw new Error('expected Flow runtime workspace-open deferred draw flush to wait for current zoom view key init transform readiness')
  }
  if (!runtimeText.includes('workspace-open-preinit-recovery-suppressed')
    || !runtimeText.includes('if (workspaceEditorOverlayOpen && lastInitTransformZoomViewKeyRef.current !== zoomViewKey) {')) {
    throw new Error('expected Flow runtime workspace-open recovery to suppress pre-init corrective transforms/draws until the current zoom view key init transform is ready')
  }
  if (!runtimeText.includes('if (shouldDeferWorkspaceOpenDraw()) return')
    || !runtimeText.includes('scheduleFlowDraw()')) {
    throw new Error('expected Flow runtime workspace-open draw paths to gate scheduleFlowDraw behind viewport-settle deferral')
  }
  if (!runtimeText.includes('if (prev != null && prev !== zoomViewKey) {')) {
    throw new Error('expected Flow runtime workspace-open recovery to reset stabilized/user-controlled authority when active view key changes')
  }
  if (!runtimeText.includes('if (open && !prev) {')
    || !runtimeText.includes('lastInitTransformZoomViewKeyRef.current = null')
    || !runtimeText.includes('lastOffscreenOverlayRecoveryKeyRef.current = null')) {
    throw new Error('expected Flow runtime workspace reopen edge to clear init/recovery memoization so stale offscreen transforms cannot persist across open->close->reopen')
  }
  if (!runtimeText.includes('if (!open) {')
    || !runtimeText.includes('Drop init/recovery memoization on close')) {
    throw new Error('expected Flow runtime workspace close edge to clear init/recovery memoization before next reopen')
  }
  if (!runtimeText.includes('const currentTransformUsable = isUsableFlowTransform(current)')) {
    throw new Error('expected Flow runtime init guard to compute current transform usability before preserving already-initialized state')
  }
  if (!runtimeText.includes('const initOverlayCollectiveState = isFlowEditor')
    || !runtimeText.includes('&& (initOverlayCollectiveState.visible !== true || initOverlayCollectiveState.offscreen === true)')) {
    throw new Error('expected Flow runtime init guard to reject workspace-open current transforms whenever the live Flow Editor overlay collective is still offscreen')
  }
  if (!runtimeText.includes('workspaceEditorOverlayOpen !== true && currentTransformUsable')) {
    throw new Error('expected Flow runtime non-workspace init-preserve guard to require usable current transform, preventing far-right offscreen preservation')
  }
  if (!runtimeText.includes('&& currentTransformUsable\n      && (workspaceOverlayStabilizedRef.current || workspaceOverlayUserControlledRef.current)')) {
    throw new Error('expected Flow runtime workspace-open init-preserve guard to require usable current transform before skipping re-fit')
  }
  if (!runtimeText.includes('const deriveExpectedOverlayCollectiveIds = React.useCallback((graphData: any): string[] => {')
    || !runtimeText.includes('const isOverlayCollectiveCoverageComplete = React.useCallback((args: {')
    || !runtimeText.includes('overlayCollectiveCoverageComplete && workspaceOverlayStabilizedRef.current')
    || !runtimeText.includes('overlayCollectiveCoverageComplete && (collectiveBalanced || collectiveCentered)')) {
    throw new Error('expected Flow runtime workspace-open preserve-current guards to require full live overlay collective coverage before stabilizing a centered frontmatter landing')
  }
  if (!runtimeText.includes('const collectiveOverlayFitIds = isFlowEditor ? deriveExpectedOverlayCollectiveIds(graphDataForFit) : []')
    || !runtimeText.includes('const hasCollectiveFlowWidgets = isFlowEditor && collectiveOverlayFitIds.length > 0')
    || !runtimeText.includes('const recoveryCollectiveOverlayFitIds = deriveExpectedOverlayCollectiveIds(recoveryGraphData)')
    || !runtimeText.includes('workspaceEditorOverlayOpen === true && recoveryCollectiveOverlayFitIds.length > 0')) {
    throw new Error('expected Flow runtime workspace-open init and recovery fits to use canonical frontmatter collective ids instead of transient live open-widget subsets')
  }
  if (!runtimeText.includes('workspace-open-stabilized-preserve-current')) {
    throw new Error('expected Flow runtime workspace-open recovery to preserve stabilized transform and forbid late fly-off refits')
  }
  if (!runtimeText.includes("reason = 'workspace-open-visible-balanced-preserve-current'") && !runtimeText.includes("lastRecoveryReason = 'workspace-open-visible-balanced-preserve-current'")) {
    throw new Error('expected Flow runtime workspace-open balanced-visible preservation to emit deterministic debug reason')
  }
  if (!runtimeText.includes('const isFlowTransformCentroidCentered = React.useCallback((args: {')
    || !runtimeText.includes('workspace-open-visible-centered-preserve-current')) {
    throw new Error('expected Flow runtime workspace-open recovery to preserve already-visible centroid-centered layouts and emit deterministic centered-preserve reason')
  }
  if (!runtimeText.includes('const deriveFlowOverlayCollectiveViewportState = React.useCallback((args: {')) {
    throw new Error('expected Flow runtime workspace-open recovery to derive viewport visibility from actual Flow Editor overlay collective bounds')
  }
  if (!runtimeText.includes('const collectiveVisible = overlayCollectiveState?.visible ?? graphVisible')
    || !runtimeText.includes('const collectiveBalanced = overlayCollectiveState?.balanced ?? graphBalanced')
    || !runtimeText.includes('const collectiveCentered = overlayCollectiveState?.centered ?? graphCentered')) {
    throw new Error('expected Flow runtime workspace-open recovery to prefer overlay collective visibility/centering over raw scene-node visibility when overlays exist')
  }
  if (!runtimeText.includes('const recoveryCanUseCollectiveOverlayFit =')
    || !runtimeText.includes("String(recoveryGraphMeta.kind || '').trim() === 'frontmatter-flow'")
    || !runtimeText.includes("recoveryGraphContext === 'frontmatter-flow'")
    || !runtimeText.includes('&& !recoveryCanUseCollectiveOverlayFit')) {
    throw new Error('expected Flow runtime workspace-open recovery fit to keep frontmatter-flow on the collective overlay fit path instead of forcing D3 graph-only recovery')
  }
  if (!runtimeText.includes('overlayCollectiveState?.offscreen === true')) {
    throw new Error('expected Flow runtime non-workspace recovery to re-center far-right offscreen overlay collectives even when the native scene is already built')
  }
  if (!runtimeText.includes("const userInteractionAfterWorkspaceOpen =")
    || !runtimeText.includes("workspace-open-user-controlled-preserve-current")) {
    throw new Error('expected Flow runtime workspace-open recovery to preserve user-controlled transforms after zoom/pan to avoid fly-off refits')
  }
  if (!runtimeText.includes('const pointerInteractionAfterWorkspaceOpen =')
    || !runtimeText.includes("(lastPointerInCanvasRef.current?.ts || 0) > workspaceOverlayOpenedAtMsRef.current + 24")
    || !runtimeText.includes('&& pointerInteractionAfterWorkspaceOpen')) {
    throw new Error('expected Flow runtime workspace-open preserve-current guard to require recent canvas-pointer activity, not just generic interaction timing')
  }
  if (!runtimeText.includes('const workspaceOverlayOffscreenSinceMsRef = React.useRef(0)')) {
    throw new Error('expected Flow runtime workspace-open recovery to track continuous offscreen duration for debounce-safe refits')
  }
  if (!runtimeText.includes('const workspaceOffscreenDebounced =')
    || !runtimeText.includes('workspace-open-offscreen-debounce-pending')) {
    throw new Error('expected Flow runtime workspace-open offscreen recovery to debounce transient visibility misses before corrective refit')
  }
  if (!runtimeText.includes('const shouldBypassWorkspaceOffscreenDebounce = overlayCollectiveState?.offscreen === true')
    || !runtimeText.includes('|| shouldBypassWorkspaceOffscreenDebounce')) {
    throw new Error('expected Flow runtime workspace-open offscreen recovery to bypass debounce for explicit fully-offscreen overlay collectives')
  }
  if (!runtimeText.includes('workspace-open-viewport-settle-pending')) {
    throw new Error('expected Flow runtime workspace-open recovery to expose deterministic viewport-settle pending reason while pane geometry stabilizes')
  }
  const computedPositionsPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowComputedPositions.ts')
  const computedPositionsText = readFileSync(computedPositionsPath, 'utf8')
  if (computedPositionsText.includes('const rev = typeof graphDataRevision')) {
    throw new Error('expected Flow computed positions graph key to avoid raw graphDataRevision churn')
  }
  if (!computedPositionsText.includes('const semanticGraphKey = buildGraphMetaKeyIgnoringPending(g)')) {
    throw new Error('expected Flow computed positions graph key to reuse semantic graph meta identity')
  }
  if (!computedPositionsText.includes('const graphKey = `graph:${semanticGraphKey}:')) {
    throw new Error('expected Flow computed positions graph key to be based on semantic graph identity')
  }
  const flowCommitGuardIndex = commitText.indexOf('const allowLayoutCommit = !workspaceMutationBlocked || allowLayoutCommitWhenWorkspaceBlocked === true')
  const flowCommitWriteIndex = commitText.indexOf('if (changed) setLayoutPositionsForMode(cacheKey, nextPositions)')
  if (flowCommitGuardIndex < 0 || flowCommitWriteIndex < 0 || flowCommitGuardIndex > flowCommitWriteIndex) {
    throw new Error('expected Flow request commit to gate layout persistence through an explicit workspace-guard override contract')
  }
  const computedGuardIndex = computedText.indexOf('!isWorkspaceGraphMutationBlocked(workspaceState)')
  const computedWriteIndex = computedText.indexOf('setLayoutPositionsForMode(cacheKey, packed)')
  if (computedGuardIndex < 0 || computedWriteIndex < 0 || computedGuardIndex > computedWriteIndex) {
    throw new Error('expected Flow computed positions to block layout cache writes while Workspace/Indexing mutation guard is active')
  }
  if (!computedText.includes("cacheScope: 'flow-canvas-computed-positions-scene-graph'") || !computedText.includes('getCachedGraphLookup({')) {
    throw new Error('expected Flow computed positions to reuse the shared scene-graph lookup helper instead of rebuilding local Mermaid sizing maps')
  }
  const storePath = resolve(process.cwd(), 'src', 'hooks', 'useGraphStore.ts')
  const storeText = readFileSync(storePath, 'utf8')
  const rootLayoutGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(get())) return')
  const rootLayoutWriteIndex = storeText.indexOf('set({ layoutPositionCacheByMode: { ...prev, [key]: positions } })')
  if (rootLayoutGuardIndex < 0 || rootLayoutWriteIndex < 0 || rootLayoutGuardIndex > rootLayoutWriteIndex) {
    throw new Error('expected root layout cache setter to reject Workspace/Indexing mutation writes')
  }
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'Toolbar.tsx')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  if (toolbarText.includes('__flowCanvasDebug.lastRuntimeTransform')) {
    throw new Error('expected temporary Flow debug readout to move out of Toolbar and reuse toast SSOT')
  }
  const debugPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'flowCanvasDebug.ts')
  const debugText = readFileSync(debugPath, 'utf8')
  if (!debugText.includes("const FLOW_CANVAS_DEBUG_TOAST_ID = 'flow-canvas-runtime-debug-status'")) {
    throw new Error('expected Flow debug helper to define a stable toast SSOT id for temporary runtime readout')
  }
  if (!text.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected FlowCanvas media overlays to reuse the shared workspace/indexing mutation guard')
  }
  if (!text.includes('const workspaceOverlayOpenRef = React.useRef(false)')) {
    throw new Error('expected FlowCanvas media overlays to track workspace overlay open state without layout-key coupling')
  }
  if (!text.includes('const [workspaceOverlayOpenKey, setWorkspaceOverlayOpenKey] = React.useState(0)')) {
    throw new Error('expected FlowCanvas media overlays to restart passive layout only on semantic workspace overlay open/close transitions')
  }
  if (!text.includes('const stopPassiveLayoutWhileWorkspaceOverlayOpen =\n      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlays to derive a frontmatter-aware passive layout exception while workspace overlay is open')
  }
  if (!text.includes('if (!active || mediaLayoutItems.length === 0 || stopPassiveLayoutWhileWorkspaceOverlayOpen)')) {
    throw new Error('expected Rich Media layout loop shutdown to exempt frontmatter document mode from workspace-open passive-layout parking')
  }
  if (!text.includes('const overlayInteractionEnabled = flowEditorOverlayInteractionMode && !workspaceOverlayOpen')) {
    throw new Error('expected Rich Media overlay interactions to disable while workspace overlay is open so collective canvas gestures stay available')
  }
  if (!text.includes("const overlayPanelPointerEventsClass = workspaceOverlayOpen ? 'pointer-events-none' : 'pointer-events-auto'")) {
    throw new Error('expected Rich Media overlays to centralize pointer-event passthrough under workspace-open state')
  }
  if (!text.includes('className={`absolute left-0 top-0 ${overlayPanelPointerEventsClass}`}')) {
    throw new Error('expected Rich Media overlays to forward pointer gestures to FlowCanvas when workspace overlay is open')
  }
  if (!text.includes('onWheelCapture={workspaceOverlayOpen ? undefined : stopEvent}')) {
    throw new Error('expected Rich Media overlay wheel capture to disable while workspace overlay is open')
  }
  if (!text.includes('const cancelMediaOverlayInteractionState = React.useCallback(() => {')) {
    throw new Error('expected FlowCanvas media overlays to centralize cancellation of delayed interaction writes')
  }
  const workspaceOpenCancelIndex = text.indexOf('if (workspaceOverlayOpenRef.current) cancelMediaOverlayInteractionState()')
  const schedulerCancelIndex = text.indexOf('mediaOverlayHeaderMoveSchedulerRef.current?.cancel()')
  if (workspaceOpenCancelIndex < 0 || schedulerCancelIndex < 0) {
    throw new Error('expected workspace overlay open transition to cancel queued Rich Media overlay writes before they can flush after close')
  }
  const richMediaRuntimeGuardIndex = text.indexOf('if (!flowEditorOverlayInteractionMode || workspaceOverlayOpenRef.current) return')
  const richMediaDirtyWriteIndex = text.indexOf('positionsDirtySinceCommitRef.current = true')
  if (richMediaRuntimeGuardIndex < 0 || richMediaDirtyWriteIndex < 0 || richMediaRuntimeGuardIndex > richMediaDirtyWriteIndex) {
    throw new Error('expected Rich Media overlay runtime position writes to be blocked while workspace overlay is open')
  }
  const resizeGuardIndex = text.indexOf('if (!workspaceOverlayOpenRef.current) {')
  const resizeWriteIndex = text.indexOf("store.updateNode?.(node.id, { properties: { ...baseProps, 'visual:width': drag.lastW, 'visual:height': drag.lastH } })")
  if (resizeGuardIndex < 0 || resizeWriteIndex < 0 || resizeGuardIndex > resizeWriteIndex) {
    throw new Error('expected Rich Media resize persistence to be blocked while workspace overlay is open')
  }
  if (text.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected FlowCanvas media overlay scheduling to avoid workspace layout refresh nonce coupling')
  }
}

export function testWorkspaceViewSelectRefreshesCollectiveLayoutWithoutCloseReopen() {
  const p = resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('bumpWorkspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Workspace View toolbar selection to avoid layout refresh nonce bump side-effects')
  }
}

export function testCollectiveInitializationIndexingAndWorkspaceToggleDoNotMutateBalancedLayoutContracts() {
  const flowEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const flowEditorText = readFileSync(flowEditorPath, 'utf8')
  if (!flowEditorText.includes('const canDeferUntilMeasuredCollectiveLayout =')) {
    throw new Error('expected Flow Editor collective layout to defer rebalance until the full measured collective is ready')
  }
  if (!flowEditorText.includes('overlayMeasurementWarmupStartedAtMsRef')) {
    throw new Error('expected Flow Editor collective layout to keep an explicit init-warmup guard against partial overlay measurements')
  }
  if (flowEditorText.includes('workspaceViewSig') || flowEditorText.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Flow Editor collective layout to stay decoupled from workspace view refresh signatures')
  }
  if (!flowEditorText.includes('flowEditorSurfaceId,')) {
    throw new Error('expected Flow Editor collective layout runtime to key collision resolution off the active overlay surface identity')
  }
  if (!flowEditorText.includes('}, [draftGraphDataRef, queryActiveSurfaceOverlays, renderGraphDataOverride, runtimeActive])')) {
    throw new Error('expected Flow Editor collective layout subscriptions to rebind through the active overlay surface query')
  }

  const mediaLoopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const mediaLoopText = readFileSync(mediaLoopPath, 'utf8')
  if (!mediaLoopText.includes('const canDeferUntilCollectiveCentersStabilize =')) {
    throw new Error('expected frontmatter Rich Media collective layout to defer rebalance until collective centers are ready')
  }
  if (!mediaLoopText.includes('collectiveCenterWarmupStartedAtMs')) {
    throw new Error('expected Rich Media collective layout loop to keep an explicit center warmup guard')
  }

  const flowEditorSurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const flowEditorSurfaceText = readFileSync(flowEditorSurfacePath, 'utf8')
  if (!flowEditorSurfaceText.includes('const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))')) {
    throw new Error('expected Flow Editor overlay surface to subscribe to shared workspace mutation state for transient visibility hold')
  }
  if (!flowEditorSurfaceText.includes('if (workspaceMutationBlocked && lastStable.length > 0) return lastStable')) {
    throw new Error('expected Flow Editor overlay ids to reuse last stable ids when flowEditorViewActive is transiently false during workspace mutation windows')
  }
  if (!flowEditorSurfaceText.includes('const overlayVisibilityActive = React.useMemo(() => {')) {
    throw new Error('expected Flow Editor overlay surface to derive one shared overlay visibility authority for active and workspace-passthrough frames')
  }
  if (!flowEditorSurfaceText.includes('return flowEditorViewActive || (workspaceInteractionPassthrough && overlayEditorNodeIds.length > 0)')) {
    throw new Error('expected Flow Editor overlay visibility authority to keep overlays active during workspace-mutation passthrough frames')
  }
  if (!flowEditorSurfaceText.includes('return buildOverlayEditorElements({') || !flowEditorSurfaceText.includes('overlayVisibilityActive,')) {
    throw new Error('expected Flow Editor widget overlays to render from the shared overlay visibility authority during workspace passthrough')
  }
  if (!flowEditorSurfaceText.includes('const workspaceInteractionPassthrough = workspaceMutationBlocked')) {
    throw new Error('expected Flow Editor overlay surface to derive interaction passthrough strictly from shared mutation-blocked state so workspace-open does not disable widget controls')
  }
  if (!flowEditorSurfaceText.includes('workspaceInteractionPassthrough,')) {
    throw new Error('expected Flow Editor overlay surface to wire interaction passthrough into overlay editors')
  }
  if (!flowEditorSurfaceText.includes('|| (workspaceInteractionPassthrough && overlayEditorNodeIds.length > 0)')) {
    throw new Error('expected Flow Editor overlay surface hasOverlayEditors guard to keep overlay layers mounted during transient workspace mutation frames')
  }
  const flowEditorSurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx'); const flowEditorSurfaceElementsText = readFileSync(flowEditorSurfaceElementsPath, 'utf8')
  if (!flowEditorSurfaceElementsText.includes('if (!args.overlayVisibilityActive) return []')) {
    throw new Error('expected Flow Editor overlay surface to keep widget overlay elements mounted from the shared passthrough visibility authority')
  }
  if (!flowEditorSurfaceText.includes('return overlayVisibilityActive && renderGraphPlacementContext?.isFrontmatterFlow === true')) {
    throw new Error('expected frontmatter rich-media coverage to stay active while workspace passthrough keeps overlays visible')
  }
  const flowEditorSurfaceVisibilityPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceVisibility.ts'); const flowEditorSurfaceVisibilityText = readFileSync(flowEditorSurfaceVisibilityPath, 'utf8')
  if (!flowEditorSurfaceVisibilityText.includes('const baseActive = overlayVisibilityActive && (hasOverlayEditors || Boolean(geospatialWidgetPanelMode))')) {
    throw new Error('expected overlay-only authority to reuse the shared overlay visibility guard during workspace passthrough')
  }
  if (!flowEditorSurfaceElementsText.includes("import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected Flow Editor overlay surface node resolution to reuse shared canonical node-id helper')
  }
  if (!flowEditorSurfaceText.includes('const lastStableRenderGraphDataOverrideRef = React.useRef<GraphData | null>(renderGraphDataOverride)')) {
    throw new Error('expected Flow Editor overlay surface to cache the last stable non-empty render graph for transient workspace recomposition windows')
  }
  if (!flowEditorSurfaceText.includes('if (renderGraphDataOverride && nodeCount > 0) lastStableRenderGraphDataOverrideRef.current = renderGraphDataOverride')) {
    throw new Error('expected Flow Editor overlay surface to refresh last stable render graph cache only from non-empty graph frames')
  }
  if (!flowEditorSurfaceText.includes('const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))')) {
    throw new Error('expected Flow Editor overlay id selection to derive workspace mutation-blocked state via shared guard')
  }
  if (!flowEditorSurfaceText.includes('if (lastStable.length > 0 && (sameGraphAsLastStable || workspaceMutationBlocked || nodes.length === 0)) return lastStable')) {
    throw new Error('expected frontmatter overlay ids to reuse last stable ids during workspace mutation or transient empty-node frames to prevent flash-missing')
  }
  if (!flowEditorSurfaceText.includes('if (workspaceMutationBlocked && lastStable.length > 0) return lastStable')) {
    throw new Error('expected frontmatter graph-available fallback to reuse last stable overlay ids while workspace mutation is blocked')
  }
  if (!flowEditorSurfaceText.includes("import { isWorkspaceEditorOverlayOpen, isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor overlay surface initialization to reuse the shared workspace/indexing mutation guard')
  }
  if (!flowEditorSurfaceText.includes('if (isWorkspaceGraphMutationBlocked(st)) return')) {
    throw new Error('expected Flow Editor overlay surface pin seeding to skip while Workspace/Indexing overlay is open')
  }
  if (!flowEditorSurfaceText.includes('const connectedValuesGraphRevision = args.flowEditorViewActive ? args.draftGraphDataRevision : args.baseGraphDataRevision')) {
    throw new Error('expected Flow Editor overlay connected-values cache to use the active draft/render graph revision')
  }
  if (!flowEditorSurfaceText.includes('const lastStableOverlayEditorNodeIdsGraphKeyRef = React.useRef<string>(\'\')')) {
    throw new Error('expected Flow Editor overlay id stability to track the semantic graph key of last stable frontmatter overlay ids')
  }
  if (!flowEditorSurfaceText.includes('const sameGraphAsLastStable = lastStableOverlayEditorNodeIdsGraphKeyRef.current === renderGraphSemanticKey')) {
    throw new Error('expected frontmatter overlay id fallback to only reuse last stable ids when semantic graph key remains unchanged')
  }
  if (!flowEditorSurfaceText.includes('if (lastStable.length > 0 && (sameGraphAsLastStable || workspaceMutationBlocked || nodes.length === 0)) return lastStable')) {
    throw new Error('expected frontmatter overlay id fallback to avoid transient empty-id unmount flicker without cross-graph stale reuse')
  }
  if (!flowEditorSurfaceElementsText.includes('const canonicalMatch = resolveGraphNodeByCanonicalId(args.renderGraphDataOverride, id)')) {
    throw new Error('expected Flow Editor overlay node resolver to recover transient composed/canonical id mismatches without close-reopen')
  }
  if (!flowEditorSurfaceElementsText.includes('const stableCanonicalMatch = resolveGraphNodeByCanonicalId(args.lastStableRenderGraphDataOverride, id)')) {
    throw new Error('expected Flow Editor overlay node resolver to reuse last stable render graph canonical lookup during transient live-graph gaps')
  }
  if (!flowEditorSurfaceVisibilityText.includes('frontmatterOverlayHideSafety.hasFullOverlayCoverageForVisibleNodes')) {
    throw new Error('expected Flow Editor frontmatter graph exclusion to require full visible-node overlay coverage before hiding base graph nodes')
  }
  if (!flowEditorSurfaceVisibilityText.includes('const useVisibleCoverageExclusion =')) {
    throw new Error('expected Flow Editor frontmatter graph exclusion to centralize coverage-gated exclusion selection')
  }

  const flowCanvasMediaPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const flowCanvasMediaText = readFileSync(flowCanvasMediaPath, 'utf8')
  if (!flowCanvasMediaText.includes('plannedOverlayNodeIdsKey')) {
    throw new Error('expected frontmatter collective scheduling to key off planned overlay ids instead of workspace view toggles')
  }
  if (!flowCanvasMediaText.includes('mediaLayoutItemIdsKey')) {
    throw new Error('expected frontmatter collective scheduling to key off active media layout items instead of workspace view toggles')
  }
  if (flowCanvasMediaText.includes('workspaceViewSig') || flowCanvasMediaText.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected frontmatter collective scheduling to stay decoupled from workspace view refresh signatures')
  }

  const graphDataSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataCommitActions.ts')
  const graphDataSliceText = readFileSync(graphDataSlicePath, 'utf8')
  if (!graphDataSliceText.includes('preserveStableSameSourceOverlayState')) {
    throw new Error('expected graph commit path to preserve stable same-source collective overlay state during indexing recomposition')
  }
  if (!graphDataSliceText.includes('resolveCommittedFlowWidgetScreenPositions')) {
    throw new Error('expected graph commit path to centralize collective screen-position carry/cleanup decisions')
  }
  if (!graphDataSliceText.includes('currentSourceIdentity === nextSourceIdentity')) {
    throw new Error('expected graph commit path to forbid cross-source frontmatter balanced overlay carry-forward on source-file switches')
  }

  const interactionRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasInteractionRuntime.tsx')
  const interactionRuntimeText = readFileSync(interactionRuntimePath, 'utf8')
  const interactionGuardIndex = interactionRuntimeText.indexOf('if (workspaceMutationBlocked) return')
  const interactionBlockedSelectorIndex = interactionRuntimeText.indexOf('isWorkspaceGraphMutationBlocked({')
  const interactionApplyIndex = interactionRuntimeText.indexOf('applyZoomRequestNative({')
  if (
    interactionApplyIndex < 0
  ) {
    throw new Error('expected FlowCanvas interaction runtime to route zoom requests through native zoom application')
  }
  if (interactionGuardIndex >= 0 || interactionBlockedSelectorIndex >= 0) {
    throw new Error('expected FlowCanvas interaction runtime zoom handling to avoid workspace mutation-block gating so manual zoom actions always function')
  }
  if (interactionRuntimeText.includes('useGraphStore.getState().clearZoomRequest()')) {
    throw new Error('expected FlowCanvas interaction runtime to avoid discarding zoom requests before native zoom application')
  }

  const uiModeActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'uiSettingsSliceModeActions.ts')
  const uiModeActionsText = readFileSync(uiModeActionsPath, 'utf8')
  const flowEditorRequestGuardCount = (uiModeActionsText.match(/nextEnabled && state\.canvasRenderMode === '2d' && state\.canvas2dRenderer !== 'flowEditor'/g) || []).length
  if (flowEditorRequestGuardCount < 2) {
    throw new Error('expected workspace mode actions to avoid emitting fit-to-view zoom requests when Flow Editor is the active 2D renderer')
  }

  const anchorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorSurfaceAnchors.ts')
  const anchorText = readFileSync(anchorPath, 'utf8')
  if (!anchorText.includes("import { resolveCanvasViewportMeasureElement } from '@/lib/canvas/viewportMeasureElement'") || !anchorText.includes('return resolveCanvasViewportMeasureElement(args.rootRef.current)')) {
    throw new Error('expected Flow Editor surface anchors to resolve canvas window offset from the canonical canvas viewport root')
  }
  if (!anchorText.includes('const resolveCanonicalCanvasWindowOffset = React.useCallback((fallbackRect?: Pick<DOMRect, \'left\' | \'top\'> | null) => {')) {
    throw new Error('expected Flow Editor surface anchors to centralize canonical canvas window offset resolution in a shared helper')
  }
  if (!anchorText.includes('const anchorRect = anchorEl?.getBoundingClientRect() || fallbackRect || null')) {
    throw new Error('expected Flow Editor surface anchors to prefer canonical viewport-root rects over transient inner-surface rects')
  }
  if (!anchorText.includes('const { left, top } = resolveCanonicalCanvasWindowOffset()')) {
    throw new Error('expected Flow Editor surface anchors to measure window offset through the shared canonical anchor-offset resolver')
  }
  if (!anchorText.includes('const { left, top } = resolveCanonicalCanvasWindowOffset(rect)')) {
    throw new Error('expected Flow Editor surface anchor writes to normalize caller-provided rects through the canonical viewport-root offset helper')
  }
  if (anchorText.includes('const left = Number.isFinite(args.containerLeft) ? args.containerLeft : 0')) {
    throw new Error('expected Flow Editor surface anchors to avoid overriding canonical window offset from transient containerLeft coordinates')
  }
  if (anchorText.includes('const top = Number.isFinite(args.containerTop) ? args.containerTop : 0')) {
    throw new Error('expected Flow Editor surface anchors to avoid overriding canonical window offset from transient containerTop coordinates')
  }
  if (anchorText.includes('const el = args.rootRef.current')) {
    throw new Error('expected Flow Editor surface anchors to avoid measuring raw rootRef coordinates directly during workspace toggles')
  }
}

export function testD3SceneBuildKeyIgnoresWorkspaceGestureOverlayToggles() {
  const helperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneSetupContext.ts')
  const helperText = readFileSync(helperPath, 'utf8')
  if (!helperText.includes('const buildKey = [')) {
    throw new Error('expected D3 scene setup helper to centralize the D3 scene build key')
  }
  if (helperText.includes('String(args.enableEditorGestures ? 1 : 0)')) {
    throw new Error('expected D3 scene build key to ignore workspace/panel gesture gating so layout does not rebuild on overlay toggles')
  }
  if (!helperText.includes('String(args.infiniteCanvasInteractionMode)')) {
    throw new Error('expected D3 scene build key to keep interaction-mode semantics while excluding overlay gesture toggles')
  }
  const hookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const hookText = readFileSync(hookPath, 'utf8')
  if (!hookText.includes('const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)')) {
    throw new Error('expected D3 scene hook to scope reactive dependencies to workspace view mode only')
  }
  if (hookText.includes('workspaceCanvasPaneOpen } = useGraphStore(')) {
    throw new Error('expected D3 scene hook to avoid subscribing scene rebuilds to workspaceCanvasPaneOpen toggle churn')
  }
  if (!hookText.includes('const workspaceOverlayOpenRef = useRef(false)')) {
    throw new Error('expected D3 scene hook to track workspace overlay-open state through a non-reactive ref')
  }
  if (!hookText.includes('s => s.workspaceViewMode')) {
    throw new Error('expected D3 scene hook overlay-open subscription to listen only to workspaceViewMode')
  }
  if (hookText.includes('s => [s.workspaceCanvasPaneOpen, s.workspaceViewMode] as const')) {
    throw new Error('expected D3 scene hook overlay-open subscription to avoid workspaceCanvasPaneOpen tuple churn')
  }
  if (!hookText.includes('const enableEditorGestures = workspaceViewMode === \'editor\'')) {
    throw new Error('expected D3 scene hook to keep pane-open overlay toggles outside scene rebuild keys')
  }
  const presentationHookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const presentationHookText = readFileSync(presentationHookPath, 'utf8')
  if (presentationHookText.includes('workspaceCanvasPaneOpen } = useGraphStore(')) {
    throw new Error('expected D3 presentation hook to avoid reacting to workspaceCanvasPaneOpen toggle churn')
  }
  if (!presentationHookText.includes('const workspaceOverlayOpenRef = useRef(false)')) {
    throw new Error('expected D3 presentation hook to use shared overlay-open refs instead of reactive pane-open subscriptions')
  }
  if (!presentationHookText.includes('s => s.workspaceViewMode')) {
    throw new Error('expected D3 presentation hook overlay-open subscription to listen only to workspaceViewMode')
  }
  if (presentationHookText.includes('s => [s.workspaceCanvasPaneOpen, s.workspaceViewMode] as const')) {
    throw new Error('expected D3 presentation hook overlay-open subscription to avoid workspaceCanvasPaneOpen tuple churn')
  }
  if (!presentationHookText.includes('const enableEditorGestures = workspaceViewMode === \'editor\'')) {
    throw new Error('expected D3 presentation hook to keep gesture-gating independent from workspace pane open/close toggles')
  }
}

export function testFlowEditorOverlayFitNormalizesSurfaceWindowOffset() {
  const zoomPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'applyZoomRequestNative.ts')
  const text = readFileSync(zoomPath, 'utf8')
  const recenterPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'flowEditorOverlayRecenter.ts'); const recenterText = readFileSync(recenterPath, 'utf8')
  if (!text.includes("import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor zoom fit path to reuse shared Workspace overlay-open SSOT helper')
  }
  if (!text.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen(state)')) {
    throw new Error('expected Flow Editor zoom fit path to derive overlay-open state from shared workspace SSOT before fit/recenter')
  }
  if (!recenterText.includes('readCanvasOverlayNodeId,') || !recenterText.includes('const nodeId = readCanvasOverlayNodeId(roots[j])')) {
    throw new Error('expected Flow Editor fit recentering to reuse shared overlay node-id resolution when translating world positions')
  }
  if (!text.includes('function resolveFlowEditorVisibleViewport(args: {')) {
    throw new Error('expected Flow Editor zoom fit to centralize visible viewport resolution')
  }
  if (!text.includes('const WORKSPACE_LEFT_PANE_SELECTOR = \'[data-kg-workspace-left-pane="1"]\'')) {
    throw new Error('expected Flow Editor zoom fit to centralize workspace left-pane selector for pane-aware visible viewport resolution')
  }
  if (!text.includes('const paneEls = Array.from(document.querySelectorAll(WORKSPACE_LEFT_PANE_SELECTOR))')) {
    throw new Error('expected Flow Editor zoom fit to query workspace left pane DOM and subtract overlap from visible viewport bounds')
  }
  if (!text.includes('visibleLeft = Math.max(visibleLeft, maxPaneRight)')) {
    throw new Error('expected Flow Editor zoom fit to shift visible viewport left edge by overlapping workspace pane width')
  }
  if (!text.includes('const surfaceRect = surfaceRoot?.getBoundingClientRect() || null')) {
    throw new Error('expected Flow Editor overlay fit bounds to resolve the active surface root window rect')
  }
  if (!text.includes('const surfaceOffsetLeft = Number.isFinite(surfaceRect?.left) ? Number(surfaceRect?.left) : 0')) {
    throw new Error('expected Flow Editor overlay fit bounds to normalize horizontal screen coordinates by active surface offset')
  }
  if (!text.includes('const surfaceOffsetTop = Number.isFinite(surfaceRect?.top) ? Number(surfaceRect?.top) : 0')) {
    throw new Error('expected Flow Editor overlay fit bounds to normalize vertical screen coordinates by active surface offset')
  }
  if (!text.includes('const surfaceOffsetLeft = Number(rect.left)')) {
    throw new Error('expected Flow Editor visible viewport resolution to normalize horizontal pane overlap into surface-local coordinates')
  }
  if (!text.includes('const paneLeft = Math.max(0, Math.min(args.viewportW, paneRect.left - surfaceOffsetLeft))')) {
    throw new Error('expected Flow Editor visible viewport resolution to subtract the active surface window offset from overlapping pane coordinates')
  }
  if (!text.includes('left: visibleLeft')) {
    throw new Error('expected Flow Editor visible viewport resolution to return a surface-local visible left edge after workspace-pane subtraction')
  }
  if (!text.includes('left: entry.rect.left - surfaceOffsetLeft')) {
    throw new Error('expected Flow Editor overlay fit bounds to store left edge in active surface-local coordinates')
  }
  if (!text.includes('top: entry.rect.top - surfaceOffsetTop')) {
    throw new Error('expected Flow Editor overlay fit bounds to store top edge in active surface-local coordinates')
  }
  if (!text.includes('const fitW = Math.max(1, visibleViewport.width - pad * 2)')) {
    throw new Error('expected Flow Editor zoom fit to clamp collective bounds to the visible viewport width when workspace editor occludes the left pane')
  }
  if (!text.includes("const isFlowEditorCollectiveOutRequest =")
    || !text.includes("&& args.zoomRequest.type === 'out'")
    || !text.includes('const flowEditorCollectiveOutResolved =')
    || !text.includes('const wantsCollectiveFloor =')
    || !text.includes('nextTransform: flowEditorCollectiveFitReference.nextTransform')) {
    throw new Error('expected Flow Editor zoom-out to reuse the collective frontmatter fit reference when generic zoom-out would otherwise snap to the old graph-only floor')
  }
  if (!text.includes('const canUseFlowEditorOverlayFitResolved =')
    || !text.includes('|| fitHasCollectiveOverlayFit')
    || !text.includes('const flowEditorOverlayFitResolved = canUseFlowEditorOverlayFitResolved')) {
    throw new Error('expected Flow Editor zoom fit to keep the overlay-bounds fit branch available for workspace-open frontmatter collective fits')
  }
  if (!text.includes('const forceImmediateWorkspaceOverlayFit = workspaceEditorOverlayOpen && isFlowEditorFitLikeRequest')) {
    throw new Error('expected Flow Editor zoom fit/reset to force immediate (non-animated) application while Workspace overlay is open')
  }
  if (!text.includes('const durationMs = forceImmediateWorkspaceOverlayFit')) {
    throw new Error('expected Flow Editor zoom duration to be forced to zero for Workspace overlay fit/reset requests')
  }
  if (!text.includes('const shouldRecenterFlowEditorCollectiveAfterFit =')
    || !text.includes('|| fitHasCollectiveOverlayFit')
    || !text.includes('if (shouldRecenterFlowEditorCollectiveAfterFit) {')
    || !text.includes('recenterVisibleFlowEditorOverlayCentroid({')) {
    throw new Error('expected Flow Editor zoom fit/reset to keep post-fit collective recentering active for workspace-open frontmatter collective fits')
  }
  if (!text.includes('const fitHasCollectiveOverlayFit =')
    || !text.includes("String(fitGraphMeta.kind || '').trim() === 'frontmatter-flow'")
    || !text.includes("fitGraphContext === 'frontmatter-flow'")
    || !text.includes('const useWorkspaceOverlayGraphFallbackFit =')
    || !text.includes('&& !fitHasCollectiveOverlayFit')) {
    throw new Error('expected Flow Editor zoom graph-fit branch to keep frontmatter-flow on the collective overlay fit path instead of forcing workspace-overlay graph-only fallback')
  }
  if (!text.includes('? fitAllTransform(')) {
    throw new Error('expected Flow Editor zoom graph-fit branch to fallback to D3 fitAllTransform while Workspace overlay is open')
  }
  if (!text.includes('Math.max(1, visibleViewport.width),')) {
    throw new Error('expected Flow Editor zoom graph-fit fallback to clamp width to visible viewport bounds while Workspace overlay is open')
  }
  if (!text.includes('Math.max(1, visibleViewport.height),')) {
    throw new Error('expected Flow Editor zoom graph-fit fallback to clamp height to visible viewport bounds while Workspace overlay is open')
  }
  if (!text.includes('const targetX = visibleViewport.centerX - (centerX - base.x) * appliedScale')) {
    throw new Error('expected Flow Editor zoom fit to center collective overlays inside the visible viewport center')
  }
  if (!text.includes('recenterVisibleFlowEditorOverlayCentroid({') || !text.includes('graphData: args.graphData,')) {
    throw new Error('expected Flow Editor fit recentering to shift widget world positions alongside viewport transform updates')
  }
  if (!text.includes('if (shouldRecenterFlowEditorCollectiveAfterFit) {')) {
    throw new Error('expected Flow Editor fit recentering to stay enabled for workspace-open frontmatter collective fits')
  }
  if (!recenterText.includes('st.setFlowWidgetWorldPosByNodeId(nextWorld)')) {
    throw new Error('expected Flow Editor fit recentering to persist translated world positions through the shared widget world-position setter')
  }
  if (!recenterText.includes('st.setFlowWidgetPosByNodeId(nextScreen)')) {
    throw new Error('expected Flow Editor fit recentering to persist translated screen positions through the shared widget screen-position setter')
  }
  if (text.includes('left: entry.rect.left,')) {
    throw new Error('expected Flow Editor overlay fit bounds to avoid raw window-space left coordinates')
  }
  const fitHelperPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'fitPinnedWidgets.ts')
  const fitHelperText = readFileSync(fitHelperPath, 'utf8')
  if (!fitHelperText.includes('const isFrontmatterOverlayFit =')) {
    throw new Error('expected Flow Editor pinned-widget fit helper to detect frontmatter-flow fit mode explicitly')
  }
  if (!fitHelperText.includes('const openIds = isFrontmatterOverlayFit')) {
    throw new Error('expected Flow Editor frontmatter-flow fit path to source open ids from the canonical frontmatter overlay set before fitting')
  }
  if (fitHelperText.includes('if (isFrontmatterOverlayFit) {\n    // Frontmatter nodes already encode the shared collective proxy layout.\n    // Reuse graph fit as the upstream basis and let later overlay-bounds refinement sharpen it.\n    return fitAllTransform(nodes, args.fitW, args.viewportH')) {
    throw new Error('expected Flow Editor frontmatter-flow fit path to avoid hard graph-only fit fallback when overlay collective ids are available')
  }
  if (!fitHelperText.includes('let kGuess = isFrontmatterOverlayFit ? neutralFrontmatterFitZoom : kBase')) {
    throw new Error('expected Flow Editor frontmatter-flow fit path to bootstrap proxy fitting from a neutral zoom instead of a tiny graph-only baseline')
  }
  if (!fitHelperText.includes('const worldById = args.worldPosById || {}')) {
    throw new Error('expected non-frontmatter pinned-widget fit path to continue using persisted world positions')
  }
}
