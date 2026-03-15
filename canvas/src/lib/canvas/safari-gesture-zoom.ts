import * as d3 from 'd3'

import type { GraphSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { mergeScaleExtentWithCurrent } from '@/lib/zoom/scaleExtent'
import { clampScale, computeAnchoredZoomTransform } from '@/lib/canvas/viewport-transform'

type LocalPointReader = (e: { clientX?: unknown; clientY?: unknown; target?: unknown; currentTarget?: unknown }) =>
  | null
  | {
      sx: number
      sy: number
      inBounds: boolean
    }

export function createSafariGestureZoomController(args: {
  active: () => boolean
  adapter: { getTransform: () => d3.ZoomTransform; setTransform: (t: d3.ZoomTransform) => void }
  getSchema: () => GraphSchema | null | undefined
  computeScaleExtent?: (args: { schema: GraphSchema; currentK: number }) => { minK: number; maxK: number }
  disableAutoZoomModes?: () => void
  onInteractionFrame?: () => void
  onCommit?: () => void
  onGestureStart?: () => void
  readLocalPoint: LocalPointReader
  getBoundingRect: () => DOMRect
}) {
  let prevScale: number | null = null

  const readScaleExtent = (schema: GraphSchema, currentK: number): { minK: number; maxK: number } =>
    typeof args.computeScaleExtent === 'function'
      ? args.computeScaleExtent({ schema, currentK })
      : (() => {
          const [schemaMinK, schemaMaxK] = readZoomScaleExtent(schema)
          return mergeScaleExtentWithCurrent({ schemaMinK, schemaMaxK, curMinK: currentK, curMaxK: currentK })
        })()

  const prevent = (event: Event) => {
    try {
      event.preventDefault()
    } catch {
      void 0
    }
  }

  const coerceScale = (event: Event): number => {
    const raw = (event as unknown as { scale?: unknown }).scale
    const scale = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1
    return scale
  }

  const applyRatio = (event: Event, ratio: number) => {
    if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 1e-6) return
    const schema = args.getSchema()
    if (!schema) return

    const t0 = args.adapter.getTransform() || d3.zoomIdentity
    const extent = readScaleExtent(schema, t0.k)
    const minK = ratio < 1 ? Math.min(extent.minK, t0.k) : extent.minK
    const nextK = clampScale(t0.k * ratio, { minK, maxK: extent.maxK })
    if (!Number.isFinite(nextK) || Math.abs(nextK - t0.k) < 1e-10) return

    const local = args.readLocalPoint(event as unknown as { clientX?: unknown; clientY?: unknown })
    const rect = args.getBoundingRect()
    const anchor = local && local.inBounds ? { sx: local.sx, sy: local.sy } : { sx: rect.width / 2, sy: rect.height / 2 }

    args.adapter.setTransform(computeAnchoredZoomTransform({ transform: t0, anchor, nextK }))
    args.onInteractionFrame?.()
    args.onCommit?.()
  }

  const handleGestureStart = (event: Event): boolean => {
    if (!args.active()) return false
    args.onGestureStart?.()
    args.disableAutoZoomModes?.()
    prevScale = coerceScale(event)
    prevent(event)
    return true
  }

  const handleGestureChange = (event: Event): boolean => {
    if (!args.active()) return false
    const prev = prevScale
    if (prev == null) return handleGestureStart(event)
    const scale = coerceScale(event)
    const ratio = scale / prev
    prevScale = scale
    args.disableAutoZoomModes?.()
    applyRatio(event, ratio)
    prevent(event)
    return true
  }

  const handleGestureEnd = (event: Event): boolean => {
    if (!args.active()) return false
    if (prevScale == null) return false
    prevScale = null
    prevent(event)
    return true
  }

  const handleGestureCancel = (event: Event): boolean => {
    if (!args.active()) return false
    if (prevScale == null) return false
    prevScale = null
    prevent(event)
    return true
  }

  return { handleGestureStart, handleGestureChange, handleGestureEnd, handleGestureCancel }
}

