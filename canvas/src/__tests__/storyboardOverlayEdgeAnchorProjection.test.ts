import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { readStoryboardOverlayFallbackRectAnchor } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetOverlayEdgeAnchors'

export function testStoryboardOverlayEdgeFallbackAnchorPreservesMeasuredOffViewportRect() {
  const leftOffViewportRect = {
    bottom: 320,
    height: 100,
    left: -180,
    right: -24,
    top: 220,
    width: 156,
  }
  const leftOutputAnchor = readStoryboardOverlayFallbackRectAnchor({
    dir: 'out',
    fallbackPct: 50,
    rect: leftOffViewportRect,
  })
  if (!leftOutputAnchor || leftOutputAnchor.x !== leftOffViewportRect.right || leftOutputAnchor.y !== 270 || leftOutputAnchor.side !== 'right') {
    throw new Error(`expected off-viewport output anchor to stay attached to measured rect right side, got ${JSON.stringify(leftOutputAnchor)}`)
  }

  const rightOffViewportRect = {
    bottom: 430,
    height: 80,
    left: 1180,
    right: 1350,
    top: 350,
    width: 170,
  }
  const rightInputAnchor = readStoryboardOverlayFallbackRectAnchor({
    dir: 'in',
    fallbackPct: 25,
    rect: rightOffViewportRect,
  })
  if (!rightInputAnchor || rightInputAnchor.x !== rightOffViewportRect.left || rightInputAnchor.y !== 370 || rightInputAnchor.side !== 'left') {
    throw new Error(`expected off-viewport input anchor to stay attached to measured rect left side, got ${JSON.stringify(rightInputAnchor)}`)
  }

  const invalidAnchor = readStoryboardOverlayFallbackRectAnchor({
    dir: 'out',
    fallbackPct: 50,
    rect: { ...leftOffViewportRect, width: 0 },
  })
  if (invalidAnchor) {
    throw new Error(`expected invalid fallback rect not to produce a detached anchor, got ${JSON.stringify(invalidAnchor)}`)
  }
}

export function testStoryboardOverlayEdgeRendererUsesMeasuredFallbackAnchorHelper() {
  const overlayEdges = readFileSync(
    resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetOverlayEdges.ts'),
    'utf8',
  )
  if (!overlayEdges.includes('readStoryboardOverlayFallbackRectAnchor({')) {
    throw new Error('expected Storyboard overlay edges to resolve fallback anchors through the shared measured-rect helper')
  }
  if (overlayEdges.includes('clampStoryboardOverlayScreenXToLocalViewportBounds') || overlayEdges.includes('computeBalancedSpreadViewportMargins')) {
    throw new Error('forbid viewport-margin clamping for measured Storyboard overlay edge endpoints')
  }
}
