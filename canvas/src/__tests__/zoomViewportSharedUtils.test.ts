import {
  computeTransformFromWorldCenter,
  computeTransformFromWorldTopLeft,
  computeTransformScaleAboutViewportFrameCenter,
  resolveContextualZoomDetail,
  screenToWorld,
} from '@/lib/zoom/viewport'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testZoomViewportWorldCenterAndTopLeftTransformsRoundTrip() {
  const center = computeTransformFromWorldCenter({
    viewportW: 800,
    viewportH: 600,
    worldX: 250,
    worldY: -40,
    k: 2,
    scaleExtent: { minK: 0.5, maxK: 4 },
  })
  const centerWorld = screenToWorld({ transform: center, sx: 400, sy: 300 })
  if (Math.abs(centerWorld.x - 250) > 1e-9 || Math.abs(centerWorld.y + 40) > 1e-9) {
    throw new Error(`expected world center round-trip, got ${JSON.stringify(centerWorld)}`)
  }

  const topLeft = computeTransformFromWorldTopLeft({
    viewportW: 800,
    viewportH: 600,
    worldX: -120,
    worldY: 90,
    k: 1.5,
    scaleExtent: { minK: 0.5, maxK: 4 },
  })
  const topLeftWorld = screenToWorld({ transform: topLeft, sx: 0, sy: 0 })
  if (Math.abs(topLeftWorld.x + 120) > 1e-9 || Math.abs(topLeftWorld.y - 90) > 1e-9) {
    throw new Error(`expected world top-left round-trip, got ${JSON.stringify(topLeftWorld)}`)
  }
}

export function testZoomViewportFrameCenterKeepsContextualFocalPointStable() {
  const transform = { k: 0.75, x: -180, y: 42 }
  const viewport = { left: 200, top: 0, right: 1000, bottom: 720, width: 800, height: 720, centerX: 600, centerY: 360 }
  const before = screenToWorld({ transform, sx: viewport.centerX, sy: viewport.centerY })
  const next = computeTransformScaleAboutViewportFrameCenter({
    transform,
    viewport,
    nextK: 1.4,
  })
  const after = screenToWorld({ transform: next, sx: viewport.centerX, sy: viewport.centerY })
  if (Math.abs(after.x - before.x) > 1e-9 || Math.abs(after.y - before.y) > 1e-9) {
    throw new Error(`expected contextual viewport-frame focal point stability, before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
  }
}

export function testContextualZoomDetailThresholdIsSharedAndNeutral() {
  const hidden = resolveContextualZoomDetail({ k: 0.49, contentThreshold: 0.5 })
  const visible = resolveContextualZoomDetail({ k: 0.5, contentThreshold: 0.5 })
  const disabled = resolveContextualZoomDetail({ k: 0.1, contentThreshold: 0 })
  if (!hidden.hidden || hidden.showContent) throw new Error('expected content to be hidden below contextual zoom threshold')
  if (visible.hidden || !visible.showContent) throw new Error('expected content to be visible at contextual zoom threshold')
  if (disabled.hidden || !disabled.showContent) throw new Error('expected threshold 0 to disable contextual content hiding')
}

export function testContextualZoomDetailSharedByD3LabelOwners() {
  const srcRoot = resolve(process.cwd(), 'src')
  const files = [
    resolve(srcRoot, 'components', 'GraphCanvas', 'zoom', 'presentation.ts'),
    resolve(srcRoot, 'components', 'GraphCanvas', 'scene.ts'),
    resolve(srcRoot, 'components', 'GraphCanvas', 'sceneHandlers.simulationTick2d.labels.ts'),
  ]
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes("resolveContextualZoomDetail")) {
      throw new Error(`expected D3 label contextual zoom owner to reuse shared helper: ${file}`)
    }
    if (text.includes('hideBelow > 0 &&') || text.includes('k < hideBelow')) {
      throw new Error(`expected D3 label contextual zoom owner to avoid local threshold math: ${file}`)
    }
  }
}
