import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterRichMediaOverlayPoolDisablesStickyCarryover() {
  const graphStatePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const text = readFileSync(graphStatePath, 'utf8')
  if (!text.includes('const useStickyOverlayPool = !flowEditorOverlayInteractionMode && !flowEditorFrontmatterInteractionMode')) {
    throw new Error('expected Flow Editor/frontmatter Rich Media overlay pool to disable sticky carryover state')
  }
  if (!text.includes('if (!useStickyOverlayPool) {')) {
    throw new Error('expected Flow Editor/frontmatter Rich Media overlay pool to follow the live suggested overlay set directly')
  }
  if (!text.includes('stickyMap.clear()')) {
    throw new Error('expected Flow Editor/frontmatter Rich Media overlay pool to clear stale sticky overlay entries before following the live set')
  }
}

export function testFlowEditorFrontmatterWidgetFallbackClearsWhenGraphIsEmpty() {
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const text = readFileSync(overlaySurfacePath, 'utf8')
  if (!text.includes('return nodes.length > 0 ? lastStableOverlayEditorNodeIdsRef.current : []')) {
    throw new Error('expected Flow Editor/frontmatter widget overlay fallback ids to clear when the transient graph is empty')
  }
}

export function testFlowEditorOverlayCollisionResetsTransientKeysWhenOverlaySetDisappears() {
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const text = readFileSync(collisionPath, 'utf8')
  if (!text.includes('const resetOverlayCollisionTransientState = React.useCallback((clearRectCache = false) => {')) {
    throw new Error('expected Flow Editor overlay collision runtime to centralize transient-state reset when overlay ids disappear')
  }
  if (!text.includes('if (overlayNodeIds.length < 2) {\n        resetOverlayCollisionTransientState(true)\n        return\n      }')) {
    throw new Error('expected Flow Editor overlay collision runtime to invalidate stale resolve keys when the overlay set transiently disappears')
  }
  if (!text.includes('if (items.length === 0) {\n        resetOverlayCollisionTransientState(true)\n        return\n      }')) {
    throw new Error('expected Flow Editor overlay collision runtime to drop stale rect cache when no movable overlay items remain')
  }
}

export function testFlowEditorOverlayCollisionRebalancesOnGraphContentRevision() {
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const runtimeStorePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeStoreState.ts')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const runtimeStoreText = readFileSync(runtimeStorePath, 'utf8')
  if (!collisionText.includes('graphContentRevision: number')) {
    throw new Error('expected Flow Editor overlay collision hook to accept graphContentRevision so indexing recomposition can invalidate stale layout state')
  }
  if (!collisionText.includes('resetOverlayCollisionTransientState()\n    scheduleOverlayCollisionResolve()')) {
    throw new Error('expected Flow Editor overlay collision effect to clear stale resolve keys before rebalancing on graph-content changes')
  }
  if (!collisionText.includes('args.graphContentRevision,')) {
    throw new Error('expected Flow Editor overlay collision effect dependencies to include graphContentRevision')
  }
  if (!runtimeStoreText.includes('graphContentRevision: s.graphContentRevision || 0')) {
    throw new Error('expected Flow Editor runtime to read graphContentRevision from store')
  }
  if (!runtimeText.includes('graphContentRevision,')) {
    throw new Error('expected Flow Editor runtime to pass graphContentRevision into overlay collision hook')
  }
}
