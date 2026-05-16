import fs from 'node:fs'
import path from 'node:path'

export function testFlowEditorRuntimeUsesOverlayCollectiveViewportStateForRecovery() {
  const runtimePath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts')
  const runtimeText = fs.readFileSync(runtimePath, 'utf8')

  if (!runtimeText.includes('const deriveFlowOverlayCollectiveViewportState = React.useCallback((args: {')) {
    throw new Error('expected Flow runtime to derive viewport visibility from actual overlay collective bounds')
  }
  if (!runtimeText.includes('const overlayCollectiveState = deriveFlowOverlayCollectiveViewportState({')) {
    throw new Error('expected Flow runtime recovery to measure overlay collective viewport state before preservation decisions')
  }
  if (!runtimeText.includes('const collectiveVisible = overlayCollectiveState?.visible ?? graphVisible')) {
    throw new Error('expected Flow runtime recovery to prefer overlay collective visibility over raw scene-node visibility when overlays exist')
  }
  if (!runtimeText.includes('const collectiveBalanced = overlayCollectiveState?.balanced ?? graphBalanced')) {
    throw new Error('expected Flow runtime recovery to prefer overlay collective balance over raw scene-node balance when overlays exist')
  }
  if (!runtimeText.includes('const collectiveCentered = overlayCollectiveState?.centered ?? graphCentered')) {
    throw new Error('expected Flow runtime recovery to prefer overlay collective centering over raw scene-node centering when overlays exist')
  }
  if (!runtimeText.includes('overlayCollectiveState?.offscreen === true')) {
    throw new Error('expected Flow runtime to recenter fully offscreen overlay collectives even after the native scene has been built')
  }
  if (!runtimeText.includes('recenterVisibleFlowEditorOverlayCentroid({')) {
    throw new Error('expected Flow runtime offscreen recovery to reuse the shared overlay-centroid recenter helper after applying the recovery fit')
  }
  if (!runtimeText.includes('if (workspaceEditorOverlayOpen && !collectiveVisible && !workspaceOffscreenDebounced) {')) {
    throw new Error('expected workspace-open offscreen debounce to track collective overlay visibility instead of raw scene visibility')
  }
  if (!runtimeText.includes('scheduleWorkspaceOffscreenRecoveryRetry(remainingMs)')) {
    throw new Error('expected workspace-open offscreen debounce to schedule a retry tick once the debounce window expires')
  }
  if (!runtimeText.includes('const shouldLatchRecoveryKey = collectiveVisible')) {
    throw new Error('expected Flow runtime offscreen recovery to latch retry suppression only after the overlay collective is visible')
  }
  if (!runtimeText.includes('lastOffscreenOverlayRecoveryKeyRef.current = shouldLatchRecoveryKey ? recoveryKey : null')) {
    throw new Error('expected Flow runtime offscreen recovery to keep retrying until a stale offscreen transform is actually displaced')
  }
  if (!runtimeText.includes('workspace-open-visible-balanced-preserve-current')) {
    throw new Error('expected workspace-open preserve path to remain active after overlay-collective visibility gating')
  }
}

export function testFlowEditorFitRecenteringClampsOverlayBoundsIntoVisibleViewport() {
  const zoomPath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'applyZoomRequestNative.ts')
  const text = fs.readFileSync(zoomPath, 'utf8')

  if (!text.includes('const desiredDeltaX = visibleViewport.centerX - centroid.x')) {
    throw new Error('expected Flow Editor overlay recentering to compute the desired horizontal centroid shift first')
  }
  if (!text.includes('const minDeltaX = visibleViewport.left - bounds.minX')) {
    throw new Error('expected Flow Editor overlay recentering to clamp against the visible viewport left edge')
  }
  if (!text.includes('const maxDeltaX = visibleViewport.right - bounds.maxX')) {
    throw new Error('expected Flow Editor overlay recentering to clamp against the visible viewport right edge')
  }
  if (!text.includes('const minDeltaY = visibleViewport.top - bounds.minY')) {
    throw new Error('expected Flow Editor overlay recentering to clamp against the visible viewport top edge')
  }
  if (!text.includes('const maxDeltaY = visibleViewport.bottom - bounds.maxY')) {
    throw new Error('expected Flow Editor overlay recentering to clamp against the visible viewport bottom edge')
  }
  if (!text.includes('? Math.max(minDeltaX, Math.min(maxDeltaX, desiredDeltaX))')) {
    throw new Error('expected Flow Editor overlay recentering to clamp horizontal recovery inside visible viewport bounds')
  }
  if (!text.includes('? Math.max(minDeltaY, Math.min(maxDeltaY, desiredDeltaY))')) {
    throw new Error('expected Flow Editor overlay recentering to clamp vertical recovery inside visible viewport bounds')
  }
}

export function testFlowEditorOverlayPlacementRuntimeSkipsTransientFarOffscreenScreenWrites() {
  const runtimePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const text = fs.readFileSync(runtimePath, 'utf8')

  if (!text.includes('const screenLooksFarOffscreen =')) {
    throw new Error('expected Flow Editor overlay placement runtime to detect far-offscreen screen coordinates during workspace-blocked pre-init')
  }
  if (!text.includes('const userDraggingScreen = !!pinnedDragOverrideRef.current || !!worldDragOverrideRef.current')) {
    throw new Error('expected Flow Editor overlay placement runtime to preserve explicit user drags while guarding transient far-offscreen screen writes')
  }
  if (!text.includes('if (zoomLooksUninitialized && !userDraggingScreen && screenLooksFarOffscreen) return')) {
    throw new Error('expected Flow Editor overlay placement runtime to skip transient far-offscreen screen writes before init-fit settles')
  }
}

export function testFlowEditorOverlayPlacementRuntimeSkipsStaleStoreZoomFallbackForWorkspaceBlockedPinnedWidgets() {
  const runtimePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const text = fs.readFileSync(runtimePath, 'utf8')

  if (!text.includes('const shouldBypassStoreZoomFallback = React.useCallback((liveZoom: { k: number; x: number; y: number } | null): boolean => {')) {
    throw new Error('expected Flow Editor overlay placement runtime to centralize the stale store-zoom fallback guard for workspace-blocked pinned widgets')
  }
  if (!text.includes('if (!isWorkspaceGraphMutationBlocked(state)) return false')) {
    throw new Error('expected Flow Editor overlay placement runtime to gate stale store-zoom bypass on workspace-blocked state')
  }
  if (!text.includes('return !!readStoredWidgetWorldPos()')) {
    throw new Error('expected Flow Editor overlay placement runtime to bypass stale store-zoom fallback only when a seeded pinned widget world position already exists')
  }
  if (!text.includes('let z = liveZoom || (bypassStoreZoomFallback ? null : zoomStateRef.current)')) {
    throw new Error('expected Flow Editor overlay placement runtime to refuse cached store zoom when workspace-blocked pinned world authority is already available')
  }
  if (!text.includes('if (!liveZoom && !bypassStoreZoomFallback && storeZoom && storeZoom !== z) {')) {
    throw new Error('expected Flow Editor overlay placement runtime to use persisted store zoom only when the workspace-blocked bypass is inactive')
  }
}

export function testFlowEditorRuntimeSceneReusesLastUsableTransformWhileWorkspaceSceneIsUnsettled() {
  const runtimeScenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const text = fs.readFileSync(runtimeScenePath, 'utf8')

  if (!text.includes("import { resolveFlowEditorVisibleViewport } from '@/components/FlowCanvas/applyZoomRequestNative'")) {
    throw new Error('expected Flow Editor runtime scene to reuse the shared pane-aware visible viewport helper')
  }
  if (!text.includes('const getVisibleViewport = React.useCallback(() => {')) {
    throw new Error('expected Flow Editor runtime scene to centralize visible viewport resolution for workspace-open layout decisions')
  }
  if (!text.includes('const normalizeTransformToVisibleViewport = React.useCallback((transform: { k: number; x: number; y: number } | null) => {')) {
    throw new Error('expected Flow Editor runtime scene to normalize candidate transforms into visible viewport coordinates before reuse checks')
  }
  if (!text.includes("reason: 'workspace-blocked-unsettled-transform-reusing-last-usable'")) {
    throw new Error('expected Flow Editor runtime scene to trace workspace-blocked unsettled transform reuse')
  }
  if (!text.includes('if (workspaceMutationBlocked && sceneNodeCount > 0 && positionsReady !== true && !interactionInProgress && !flowWidgetDragging) {')) {
    throw new Error('expected Flow Editor runtime scene to guard live transform adoption while workspace scene positions are unsettled')
  }
  if (!text.includes('return lastUsable')) {
    throw new Error('expected Flow Editor runtime scene to reuse the last usable transform during workspace-scene recomposition')
  }
}

export function testFlowEditorRuntimeSceneUsesNeutralSeedZoomForWorkspaceBlockedFrontmatterLanding() {
  const runtimeScenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const text = fs.readFileSync(runtimeScenePath, 'utf8')

  if (!text.includes('const workspaceMutationBlockedForSeed = isWorkspaceGraphMutationBlocked(st)')) {
    throw new Error('expected Flow Editor runtime scene seeding to derive a single workspace-blocked guard for frontmatter landing')
  }
  if (!text.includes('|| (isFrontmatterFlow && workspaceMutationBlockedForSeed)')) {
    throw new Error('expected Flow Editor runtime scene seeding to force neutral viewport bounds while frontmatter landing is workspace-blocked')
  }
  if (!text.includes('const allowPersistedViewportOffsetSeed = !workspaceMutationBlockedForSeed')) {
    throw new Error('expected Flow Editor runtime scene seeding to reject persisted viewport-offset seed bounds while workspace landing is blocked')
  }
  if (!text.includes('const visibleViewport = getVisibleViewport()')) {
    throw new Error('expected Flow Editor runtime scene seeding to derive a pane-aware visible viewport before sizing the frontmatter collective')
  }
  if (!text.includes('viewportW: visibleViewport.width,')
    || !text.includes('viewportH: visibleViewport.height,')) {
    throw new Error('expected Flow Editor runtime scene seeding to size frontmatter collective scale against the visible viewport strip')
  }
  if (!text.includes('minX: (visibleViewport.left - zoomX) / safeZoomK')
    || !text.includes('maxX: (visibleViewport.right - zoomX) / safeZoomK')) {
    throw new Error('expected Flow Editor runtime scene viewport bucket to anchor frontmatter seeding to the visible strip instead of the full surface')
  }
}

export function testFlowEditorRuntimeSceneNeutralizesPoisonedTransformForAutoSeededWidgets() {
  const runtimeScenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const text = fs.readFileSync(runtimeScenePath, 'utf8')

  if (!text.includes('const autoSeedWorldNodes = Object.values(latestAutoSeedWorldPosByNodeIdRef.current || {})')) {
    throw new Error('expected Flow Editor runtime scene to validate workspace-blocked transforms against auto-seeded widget world positions')
  }
  if (!text.includes("reason: 'workspace-blocked-auto-seed-transform-neutralized'")) {
    throw new Error('expected Flow Editor runtime scene to trace auto-seeded widget transform neutralization when the cached transform hides the collective')
  }
  if (!text.includes("reason: 'workspace-blocked-auto-seed-transform-reusing-last-usable'")) {
    throw new Error('expected Flow Editor runtime scene to reuse only a last usable transform that still keeps auto-seeded widgets visible')
  }
  if (!text.includes('const lastUsableAutoSeedWorldRects = buildAutoSeedWorldRectsForTransform(lastUsable)')) {
    throw new Error('expected Flow Editor runtime scene unsettled-transform guard to derive auto-seeded widget bounds for the last usable transform before reuse')
  }
  if (!text.includes('const normalizedLastUsable = normalizeTransformToVisibleViewport(lastUsable)')) {
    throw new Error('expected Flow Editor runtime scene auto-seed guard to normalize last usable transforms into visible viewport coordinates before reuse')
  }
  if (!text.includes('const lastUsableShowsAutoSeed =')) {
    throw new Error('expected Flow Editor runtime scene unsettled-transform guard to compute a dedicated last usable auto-seed visibility verdict before reuse')
  }
  if (!text.includes('&& isFlowTransformKeepingWorldRectCollectiveInViewport(normalizedLastUsable, {')) {
    throw new Error('expected Flow Editor runtime scene unsettled-transform guard to validate last usable transforms against auto-seeded widget viewport fit before reuse')
  }
  if (!text.includes("reason: 'workspace-blocked-unsettled-transform-neutralized-for-auto-seed'")) {
    throw new Error('expected Flow Editor runtime scene unsettled-transform guard to neutralize poisoned cached transforms that hide auto-seeded widgets')
  }
  if (!text.includes('const autoSeedWorldRects = buildAutoSeedWorldRectsForTransform(next)')) {
    throw new Error('expected Flow Editor runtime scene to derive auto-seeded widget world rects from the candidate transform before validating viewport fit')
  }
  if (!text.includes('isFlowTransformKeepingWorldRectCollectiveInViewport(normalizedNext, {')) {
    throw new Error('expected Flow Editor runtime scene to reject transforms that still push the auto-seeded widget collective outside the viewport')
  }
  if (!text.includes('isFlowTransformKeepingWorldRectCollectiveInViewport(normalizedLastUsable, {')) {
    throw new Error('expected Flow Editor runtime scene to reuse last usable transforms only when the auto-seeded widget collective still fits in the viewport')
  }
}

export function testFlowEditorRuntimeScenePrefersAutoSeedWorldPosForWorkspaceBlockedFrontmatterWidgets() {
  const runtimeScenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const text = fs.readFileSync(runtimeScenePath, 'utf8')

  if (!text.includes('const autoSeed = latestAutoSeedWorldPosByNodeIdRef.current[id]')) {
    throw new Error('expected Flow Editor runtime scene live node reader to inspect the latest auto-seeded widget world positions first')
  }
  if (!text.includes('const workspaceMutationBlocked = isWorkspaceGraphMutationBlocked(state)')) {
    throw new Error('expected Flow Editor runtime scene live node reader to derive a single workspace-blocked guard before choosing widget world authority')
  }
  if (!text.includes('if (workspaceMutationBlocked && autoSeedX != null && autoSeedY != null && !interactionInProgress && !flowWidgetDragging) {')) {
    throw new Error('expected Flow Editor runtime scene live node reader to prefer auto-seeded widget world positions whenever workspace-blocked landing exposes a valid widget seed')
  }
  if (!text.includes('return { x: autoSeedX, y: autoSeedY }')) {
    throw new Error('expected Flow Editor runtime scene live node reader to hand widget overlays the centered auto-seeded world position before stale runtime scene coordinates')
  }
}
