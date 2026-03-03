import { resolveScaleExtentForZoomRequest } from '@/lib/zoom/scaleExtentPolicy'
import { DEFAULT_TOOLBAR_ZOOM_CONFIG } from '@/lib/zoom/toolbarZoom'

export function testZoomScaleExtentPolicyExpandsMaxForToolbarZoomIn() {
  const extent = resolveScaleExtentForZoomRequest({
    zoomRequest: { type: 'in' },
    schemaExtent: { minK: 0.25, maxK: 2 },
    currentExtent: { minK: 0.25, maxK: 2 },
    currentTransform: { k: 2 },
    toolbarZoom: { ...DEFAULT_TOOLBAR_ZOOM_CONFIG, scaleFactor: 1.25 },
  })
  if (extent.maxK < 2.5 - 1e-12) {
    throw new Error(`expected maxK >= 2.5, got ${extent.maxK}`)
  }
}

export function testZoomScaleExtentPolicyExpandsMinForToolbarZoomOut() {
  const extent = resolveScaleExtentForZoomRequest({
    zoomRequest: { type: 'out' },
    schemaExtent: { minK: 0.5, maxK: 4 },
    currentExtent: { minK: 0.5, maxK: 4 },
    currentTransform: { k: 0.5 },
    toolbarZoom: { ...DEFAULT_TOOLBAR_ZOOM_CONFIG, scaleFactor: 1.25 },
  })
  if (extent.minK > 0.4 + 1e-12) {
    throw new Error(`expected minK <= 0.4, got ${extent.minK}`)
  }
}

export function testZoomScaleExtentPolicyDoesNotChangeExtentForFit() {
  const extent = resolveScaleExtentForZoomRequest({
    zoomRequest: { type: 'fit', intent: 'fitToView' },
    schemaExtent: { minK: 0.25, maxK: 2 },
    currentExtent: { minK: 0.25, maxK: 2 },
    currentTransform: { k: 2 },
    toolbarZoom: { ...DEFAULT_TOOLBAR_ZOOM_CONFIG, scaleFactor: 1.25 },
  })
  if (Math.abs(extent.minK - 0.25) > 1e-12 || Math.abs(extent.maxK - 2) > 1e-12) {
    throw new Error(`expected extent unchanged for fit, got ${extent.minK}..${extent.maxK}`)
  }
}

