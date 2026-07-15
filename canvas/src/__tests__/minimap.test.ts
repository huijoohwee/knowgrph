import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  computeGraphBounds,
  computeTransformFromCenter,
  computeTransformFromViewTopLeft,
  computeMinimapProjection,
  computeViewRect,
  projectMinimapPointToWorld,
  projectWorldRectToMinimap,
  readMinimapNodeCenter,
  unionMinimapBoundsWithRect,
} from '@/features/minimap/math'
import { buildEdgesPathD, buildNodesPathD } from '@/features/minimap/renderer'

export const testComputeViewRect = () => {
  const vw = 800, vh = 600, sx = 0.2
  const t = { k: 2, x: 100, y: 50 }
  const r = computeViewRect(vw, vh, t.k, t.x, t.y, sx)
  const expected = {
    x: ((0 - t.x) / t.k) * sx,
    y: ((0 - t.y) / t.k) * sx,
    w: (vw / t.k) * sx,
    h: (vh / t.k) * sx,
  }
  if (Math.abs(r.x - expected.x) > 1e-6) throw new Error('viewRect x mismatch')
  if (Math.abs(r.y - expected.y) > 1e-6) throw new Error('viewRect y mismatch')
  if (Math.abs(r.w - expected.w) > 1e-6) throw new Error('viewRect w mismatch')
  if (Math.abs(r.h - expected.h) > 1e-6) throw new Error('viewRect h mismatch')

  const centered = computeTransformFromCenter(800, 600, 120, -40, 2, { minScale: 0.1, maxScale: 4 })
  if (centered.k !== 2 || Math.abs(centered.x - 160) > 1e-9 || Math.abs(centered.y - 380) > 1e-9) {
    throw new Error(`expected minimap center transform to reuse shared viewport math, got ${JSON.stringify(centered)}`)
  }
  const topLeft = computeTransformFromViewTopLeft(800, 600, 2, -20, 30)
  if (topLeft.k !== 2 || Math.abs(topLeft.x - 40) > 1e-9 || Math.abs(topLeft.y + 60) > 1e-9) {
    throw new Error(`expected minimap top-left transform to reuse shared viewport math, got ${JSON.stringify(topLeft)}`)
  }

  const panelNode = { id: 'panel', x: 10, y: 20, width: 40, height: 10 }
  const bounds = computeGraphBounds([panelNode], 5)
  if (bounds.minX !== 5 || bounds.maxX !== 55 || bounds.minY !== 15 || bounds.maxY !== 35) {
    throw new Error(`expected minimap bounds to include node extents, got ${JSON.stringify(bounds)}`)
  }
  const center = readMinimapNodeCenter(panelNode)
  if (!center || center.x !== 30 || center.y !== 25) {
    throw new Error(`expected minimap node center to use rectangular extents, got ${JSON.stringify(center)}`)
  }

  const union = unionMinimapBoundsWithRect(
    { minX: 10, minY: 10, maxX: 20, maxY: 20, width: 10, height: 10 },
    { x: -5, y: -10, w: 8, h: 12 },
  )
  if (union.minX !== -5 || union.minY !== -10 || union.maxX !== 20 || union.maxY !== 20) {
    throw new Error(`expected viewport rect to extend minimap bounds, got ${JSON.stringify(union)}`)
  }
  const projection = computeMinimapProjection(union, { w: 100, h: 60 })
  const projectedRect = projectWorldRectToMinimap({ x: -5, y: -10, w: 8, h: 12 }, union, projection.sx)
  const unprojectedPoint = projectMinimapPointToWorld({ x: projectedRect.x, y: projectedRect.y }, union, projection.sx)
  if (Math.abs(unprojectedPoint.x + 5) > 1e-6 || Math.abs(unprojectedPoint.y + 10) > 1e-6) {
    throw new Error('expected minimap projection helpers to round-trip viewport origin')
  }
  const containedBounds = { minX: -20, minY: -20, maxX: 120, maxY: 90, width: 140, height: 110 }
  const containedUnion = unionMinimapBoundsWithRect(containedBounds, { x: 10, y: 15, w: 40, h: 25 })
  if (containedUnion !== containedBounds) {
    throw new Error('expected minimap viewport union to preserve bounds identity when the viewport stays inside graph bounds')
  }

  const rectPath = buildNodesPathD([panelNode], { minX: 0, minY: 0 }, 1, 3, 'rect-shape')
  if (!rectPath.includes('M10,20h40v10h-40v-10Z')) {
    throw new Error(`expected minimap renderer to draw rectangular node extents, got ${rectPath}`)
  }

  const staleKeyA = buildNodesPathD([{ id: 'same', x: 0, y: 0 }], { minX: 0, minY: 0 }, 1, 3, 'same-graph')
  const staleKeyB = buildNodesPathD([{ id: 'same', x: 10, y: 10 }], { minX: 0, minY: 0 }, 1, 3, 'same-graph')
  if (staleKeyA === staleKeyB) {
    throw new Error('expected minimap path cache to include node geometry, not only graph id and counts')
  }

  const edgePath = buildEdgesPathD(
    [
      { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      { id: 'b', x: 20, y: 0, width: 10, height: 10 },
    ],
    [{ id: 'ab', source: 'a', target: 'b' }],
    { minX: 0, minY: 0 },
    1,
    'rect-edge',
  )
  if (edgePath !== 'M5,5L25,5') {
    throw new Error(`expected minimap edges to connect rectangle centers, got ${edgePath}`)
  }
}

export const testMinimapSurfaceUsesStableSemanticMarkers = () => {
  const viewport = readFileSync(resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx'), 'utf8')
  const minimap = readFileSync(resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx'), 'utf8')
  for (const marker of [
    'minimapOverlayVisible',
    "activeSurface === '3d' && effectiveCanvas3dMode === '3d'",
    'data-kg-minimap-overlay-surface={minimapOverlaySurface}',
    'data-kg-minimap-overlay-placement="bottom-left"',
    'data-kg-css-inspector-selectable="minimap-overlay"',
  ]) {
    if (!viewport.includes(marker)) throw new Error(`expected CanvasViewport to expose minimap overlay marker ${marker}`)
  }
  for (const marker of [
    'data-kg-minimap-root="1"',
    'data-kg-minimap-surface="1"',
    'data-kg-minimap-svg="1"',
    'data-kg-css-inspector-selectable="minimap"',
    'data-kg-css-inspector-selectable="minimap-surface"',
    'relative isolate group kg-minimap-root',
    'kg-minimap-surface',
    'kg-minimap-svg',
  ]) {
    if (!minimap.includes(marker)) throw new Error(`expected minimap to expose semantic marker ${marker}`)
  }
}
