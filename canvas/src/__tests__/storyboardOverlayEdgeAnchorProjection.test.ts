import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { clampStoryboardOverlayScreenXToLocalViewportBounds } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetOverlayEdgeAnchors'

export function testStoryboardOverlayEdgeFallbackAnchorClampsInRootLocalSpace() {
  const rootLeft = 240
  const rootWidth = 1000
  const marginLeft = 120
  const marginRight = 80
  const insideRightScreenX = rootLeft + rootWidth - 100
  const clampedInside = clampStoryboardOverlayScreenXToLocalViewportBounds({
    screenX: insideRightScreenX,
    rootLeft,
    rootWidth,
    marginLeft,
    marginRight,
  })
  if (clampedInside !== insideRightScreenX) {
    throw new Error(`expected in-bounds card anchor to stay attached, got ${clampedInside}`)
  }

  const leftOverflow = clampStoryboardOverlayScreenXToLocalViewportBounds({
    screenX: rootLeft + 40,
    rootLeft,
    rootWidth,
    marginLeft,
    marginRight,
  })
  if (leftOverflow !== rootLeft + marginLeft) {
    throw new Error(`expected left overflow to clamp in root-local space, got ${leftOverflow}`)
  }

  const rightOverflow = clampStoryboardOverlayScreenXToLocalViewportBounds({
    screenX: rootLeft + rootWidth + 40,
    rootLeft,
    rootWidth,
    marginLeft,
    marginRight,
  })
  if (rightOverflow !== rootLeft + rootWidth - marginRight) {
    throw new Error(`expected right overflow to clamp in root-local space, got ${rightOverflow}`)
  }
}

export function testStoryboardOverlayEdgeRendererUsesSharedLocalAnchorClamp() {
  const overlayEdges = readFileSync(
    resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetOverlayEdges.ts'),
    'utf8',
  )
  if (!overlayEdges.includes('clampStoryboardOverlayScreenXToLocalViewportBounds({')) {
    throw new Error('expected Storyboard overlay edges to clamp fallback anchors through the shared local-space helper')
  }
  if (overlayEdges.includes('Math.min(Math.max(baseX, balancedMargins.left)')) {
    throw new Error('forbid viewport-space fallback anchors clamped against root-local margins')
  }
}
