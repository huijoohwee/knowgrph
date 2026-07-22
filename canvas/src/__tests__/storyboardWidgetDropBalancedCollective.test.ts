import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { useGraphStore } from '@/hooks/useGraphStore'
import { restoreStoryboardWidgetDropCameraAuthority } from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'

export function testStoryboardWidgetDropRestoresCameraAndRequestsBalancedCollective() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow', source: 'markdown:workspace.md' },
    nodes: [],
    edges: [],
  })
  const zoomViewKeyRef = { current: 'storyboard:workspace.md' }
  restoreStoryboardWidgetDropCameraAuthority({
    authority: {
      zoomViewKey: zoomViewKeyRef.current,
      transform: { k: 1, x: 144, y: 96 },
    },
    zoomViewKeyRef,
    requestBalancedLayout: true,
  })

  const state = useGraphStore.getState()
  const keyed = state.zoomStateByKey[zoomViewKeyRef.current]
  if (!keyed || keyed.k !== 1 || keyed.x !== 144 || keyed.y !== 96) {
    throw new Error(`expected drop camera authority to persist the exact active transform, got ${JSON.stringify(keyed)}`)
  }
  if (state.zoomRequest?.type !== 'transform'
    || state.zoomRequest.payload.k !== 1
    || state.zoomRequest.payload.x !== 144
    || state.zoomRequest.payload.y !== 96) {
    throw new Error(`expected drop camera authority to reassert the exact active transform, got ${JSON.stringify(state.zoomRequest)}`)
  }
  if (state.storyboardWidgetLayoutRebalanceRequest?.type !== 'balanced-spread') {
    throw new Error(`expected drop to request one balanced collective layout, got ${JSON.stringify(state.storyboardWidgetLayoutRebalanceRequest)}`)
  }
}

export function testFrontmatterGrowthReseedsWholeBalancedCollective() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetRuntimeScene.ts')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlayCollision.ts')
  const projectionPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'useStoryboardCardOverlayProjection2d.ts')
  const placementsPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'storyboardCardPlacements2d.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const projectionText = readFileSync(projectionPath, 'utf8')
  const placementsText = readFileSync(placementsPath, 'utf8')
  if (!runtimeText.includes('&& !isFrontmatterFlow\n      && pendingRaw.length > 0')) {
    throw new Error('expected frontmatter Widget/Rich Media growth to bypass single-node incremental placement')
  }
  if (!runtimeText.includes('if (shouldReseedWholeFrontmatterCollective) pending = fullFrontmatterCollectiveIds')) {
    throw new Error('expected new frontmatter overlays to use the complete collective as balanced-spread layout authority')
  }
  if (!collisionText.includes('article[aria-label^="Storyboard card"][data-node-id]')
    || !collisionText.includes('id: `storyboard-card:${id}`')) {
    throw new Error('expected authored Storyboard cards to participate as full-size collision obstacles for Widget/Rich Media cascade placement')
  }
  for (const snippet of [
    'const targetAspect = 16 / 9',
    'Math.ceil(Math.sqrt(cardCount * targetAspect / cellAspect))',
    'const columnIndex = index % columnCount',
    'const rowIndex = Math.floor(index / columnCount)',
  ]) {
    if (!placementsText.includes(snippet)) {
      throw new Error(`expected fixed cards to use balanced 2D waterfall placement via ${snippet}`)
    }
  }
  for (const snippet of [
    "'[data-kg-rich-media-overlay=\"1\"]'",
    'relaxOverlayPanelsWithCollision({',
    'settledWorldByCardIdRef',
    'const worldById = new Map<string, StoryboardCardPlacement>()',
    'if (fixedLayoutEnabled) return rawBox',
  ]) {
    if (!projectionText.includes(snippet)) {
      throw new Error(`expected fixed-card projection to enforce balanced Widget/Rich Media layout via ${snippet}`)
    }
  }
}

export function testFixedCardProjectionFreezesBalancedWorldLayoutDuringCollectiveCameraMotion() {
  const projectionPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'useStoryboardCardOverlayProjection2d.ts')
  const projectionText = readFileSync(projectionPath, 'utf8')
  for (const snippet of [
    'settledWorldByCardIdRef',
    'worldById: Map<string, StoryboardCardPlacement>',
    'if (fixedLayoutEnabled) return rawBox',
    'screenToWorld({',
  ]) {
    if (!projectionText.includes(snippet)) {
      throw new Error(`expected fixed Card projection to preserve one world-space collective through drag/pan/zoom via ${snippet}`)
    }
  }
  for (const stale of [
    'const currentDomRect = item.el.getBoundingClientRect()',
    'const projectionOffsetLeft = previouslyApplied',
    'const finalSettledCardBoxes:',
    'STORYBOARD_WIDGET_SCREEN_AUTHORITY_COLLECTIVE_PAN_EVENT',
  ]) {
    if (projectionText.includes(stale)) {
      throw new Error(`expected camera motion to avoid per-frame Card/Rich Media layout mutation via ${stale}`)
    }
  }
}
