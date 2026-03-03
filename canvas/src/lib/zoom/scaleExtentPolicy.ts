import type { ZoomRequest } from '@/lib/zoom/requests'
import type { ToolbarZoomConfig } from '@/lib/zoom/toolbarZoom'
import { mergeScaleExtentWithCurrent, safeScaleExtent, type ScaleExtent } from '@/lib/zoom/scaleExtent'

export function resolveScaleExtentForZoomRequest(args: {
  zoomRequest: ZoomRequest
  schemaExtent: ScaleExtent
  currentExtent?: ScaleExtent
  currentTransform: { k: number }
  toolbarZoom?: ToolbarZoomConfig
}): ScaleExtent {
  const merged = mergeScaleExtentWithCurrent({
    schemaMinK: args.schemaExtent.minK,
    schemaMaxK: args.schemaExtent.maxK,
    curMinK: args.currentExtent?.minK,
    curMaxK: args.currentExtent?.maxK,
  })

  const factorRaw = args.toolbarZoom?.scaleFactor
  const factor = typeof factorRaw === 'number' && Number.isFinite(factorRaw) && factorRaw > 1 ? factorRaw : null
  if (!factor) return merged

  const type = args.zoomRequest.type
  if (type !== 'in' && type !== 'out') return merged

  const k0 = typeof args.currentTransform.k === 'number' && Number.isFinite(args.currentTransform.k) && args.currentTransform.k > 0
    ? args.currentTransform.k
    : 1

  if (type === 'in') {
    return safeScaleExtent({ minK: merged.minK, maxK: Math.max(merged.maxK, k0 * factor) })
  }

  return safeScaleExtent({ minK: Math.min(merged.minK, k0 / factor), maxK: merged.maxK })
}

