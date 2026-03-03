import type * as d3 from 'd3'

import type { ZoomRequest } from '@/lib/zoom/requests'
import type { ToolbarZoomConfig } from '@/lib/zoom/toolbarZoom'
import { DEFAULT_ZOOM_MAX_SCALE_HARD_CAP, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP } from '@/lib/graph/layoutDefaults'
import { safeScaleExtent, type ScaleExtent } from '@/lib/zoom/scaleExtent'

export function resolveScaleExtentForZoomRequest(args: {
  zoomRequest: ZoomRequest | null
  currentTransform: Pick<d3.ZoomTransform, 'k'> | null
  schemaScaleExtent: ScaleExtent
  currentScaleExtent?: ScaleExtent | null
  toolbarZoom?: ToolbarZoomConfig | null
}): ScaleExtent {
  const schemaMinK = args.schemaScaleExtent.minK
  const schemaMaxK = args.schemaScaleExtent.maxK
  const curExtent = args.currentScaleExtent
  let minK = Math.min(curExtent?.minK ?? schemaMinK, schemaMinK)
  let maxK = Math.max(curExtent?.maxK ?? schemaMaxK, schemaMaxK)

  const k0 = Number.isFinite(args.currentTransform?.k) ? (args.currentTransform as { k: number }).k : 1
  const req = args.zoomRequest
  const toolbarFactorRaw = args.toolbarZoom?.scaleFactor
  const toolbarFactor = typeof toolbarFactorRaw === 'number' && Number.isFinite(toolbarFactorRaw) && toolbarFactorRaw > 1 ? toolbarFactorRaw : null
  if (toolbarFactor && req && (req.type === 'in' || req.type === 'out')) {
    if (req.type === 'in') {
      maxK = Math.max(maxK, k0 * toolbarFactor)
    } else {
      minK = Math.min(minK, k0 / toolbarFactor)
    }
  }

  let extent = safeScaleExtent({ minK, maxK })
  if (!(extent.maxK > extent.minK + 1e-12)) {
    extent = safeScaleExtent({
      minK: Math.min(extent.minK, k0, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP),
      maxK: Math.max(extent.maxK, k0, DEFAULT_ZOOM_MAX_SCALE_HARD_CAP),
    })
  }
  return extent
}

