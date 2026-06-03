import {
  clampLocalOverlayTopLeftFullyInViewport,
  clampOverlayCenterToViewport,
  clampOverlayTopLeftFullyInViewport,
  clampOverlayTopLeftToViewport,
} from '@/lib/ui/overlayClamp'

export function testOverlayClampKeepsPanelInViewport() {
  const clamped = clampOverlayTopLeftToViewport({
    pos: { top: -999, left: 999 },
    size: { width: 200, height: 120 },
    viewport: { width: 500, height: 400 },
    visiblePx: 32,
  })
  if (!(clamped.left <= 500 - 32)) throw new Error('expected left to be clamped to max visible bound')
  if (!(clamped.left >= 32 - 200)) throw new Error('expected left to be clamped to min visible bound')
  if (!(clamped.top <= 400 - 32)) throw new Error('expected top to be clamped to max visible bound')
  if (!(clamped.top >= 32 - 120)) throw new Error('expected top to be clamped to min visible bound')
}

export function testOverlayClampSnapPxRoundsToGrid() {
  const clamped = clampOverlayTopLeftToViewport({
    pos: { top: 10.3, left: 20.7 },
    size: { width: 200.2, height: 120.9 },
    viewport: { width: 500, height: 400 },
    visiblePx: 32,
    snapPx: 1,
  })
  if (Math.abs(clamped.top - Math.round(clamped.top)) > 1e-9) throw new Error('expected top snapped to integer px')
  if (Math.abs(clamped.left - Math.round(clamped.left)) > 1e-9) throw new Error('expected left snapped to integer px')
}

export function testOverlayClampFullyInViewport() {
  const clamped = clampOverlayTopLeftFullyInViewport({
    pos: { top: -999, left: 999 },
    size: { width: 200, height: 120 },
    viewport: { width: 500, height: 400 },
  })
  if (!(clamped.left >= 0)) throw new Error('expected left to be clamped to 0')
  if (!(clamped.left <= 500 - 200)) throw new Error('expected left to be clamped to max inside bound')
  if (!(clamped.top >= 0)) throw new Error('expected top to be clamped to 0')
  if (!(clamped.top <= 400 - 120)) throw new Error('expected top to be clamped to max inside bound')
}

export function testOverlayClampCenterRespectsInset() {
  const clamped = clampOverlayCenterToViewport({
    pos: { top: -999, left: -999 },
    size: { width: 200, height: 100 },
    viewport: { width: 500, height: 400 },
    visiblePx: 32,
    inset: { top: 50 },
  })
  const halfH = 50
  const halfW = 100
  const minTop = 50 + 32 - halfH
  const minLeft = 0 + 32 - halfW
  if (!(clamped.top >= minTop)) throw new Error('expected center top to respect top inset')
  if (!(clamped.left >= minLeft)) throw new Error('expected center left to respect visible bound')
}

export function testOverlayClampLocalPositionKeepsMenuInViewport() {
  const clamped = clampLocalOverlayTopLeftFullyInViewport({
    localPos: { top: 290, left: 360 },
    localRootRect: { top: 24, left: 32 },
    size: { width: 180, height: 140 },
    viewport: { width: 420, height: 360 },
    snapPx: 1,
  })
  if (clamped.left !== 208) {
    throw new Error(`expected local overlay left to account for root offset and viewport width, got ${clamped.left}`)
  }
  if (clamped.top !== 196) {
    throw new Error(`expected local overlay top to account for root offset and viewport height, got ${clamped.top}`)
  }
}
