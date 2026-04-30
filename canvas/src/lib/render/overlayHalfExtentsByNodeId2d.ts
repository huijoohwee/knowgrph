import type { GraphNode } from '@/lib/graph/types'
import type { MediaPanelDensity } from '@/lib/render/mediaPanelSpec'
import type { NodeHalfExtents } from '@/components/GraphCanvas/layout/overlap'
import { computeOverlayHalfExtentsWorld, DEFAULT_OVERLAY_SIZING_CONFIG, normalizeOverlaySizingConfig } from '@/lib/render/overlaySizing2d'

export function computeOverlayHalfExtentsByNodeId2d(args: {
  nodes: GraphNode[]
  panelOnlyNodeIdSet?: Set<string> | null
  mediaOverlayNodeIdSet?: Set<string> | null
  viewportW: number
  viewportH?: number
  zoomK: number
  mediaPanelDensity: MediaPanelDensity
  overlaySizing?: {
    overlayBaseWidthRatioDefault?: number
    overlayBaseWidthRatioCompact?: number
    overlayBaseWidthMinPxDefault?: number
    overlayBaseWidthMinPxCompact?: number
    overlayBaseWidthMaxPxDefault?: number
    overlayBaseWidthMaxPxCompact?: number
  } | null
}): Record<string, NodeHalfExtents> | null {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (nodes.length === 0) return null

  const panelOnly = args.panelOnlyNodeIdSet || null
  const mediaOnly = args.mediaOverlayNodeIdSet || null
  if ((!panelOnly || panelOnly.size === 0) && (!mediaOnly || mediaOnly.size === 0)) return null

  const ids = new Set<string>()
  if (panelOnly) for (const id of panelOnly) ids.add(String(id || '').trim())
  if (mediaOnly) for (const id of mediaOnly) ids.add(String(id || '').trim())
  ids.delete('')
  if (ids.size === 0) return null

  const byId = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String((n as any)?.id || '').trim()
    if (!id) continue
    if (!byId.has(id)) byId.set(id, n)
  }

  const density: MediaPanelDensity = args.mediaPanelDensity === 'compact' ? 'compact' : 'default'
  const sizing = args.overlaySizing || null
  const overlayCfg = normalizeOverlaySizingConfig({
    widthRatio:
      density === 'compact'
        ? typeof sizing?.overlayBaseWidthRatioCompact === 'number' && Number.isFinite(sizing.overlayBaseWidthRatioCompact)
          ? sizing.overlayBaseWidthRatioCompact
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio
        : typeof sizing?.overlayBaseWidthRatioDefault === 'number' && Number.isFinite(sizing.overlayBaseWidthRatioDefault)
          ? sizing.overlayBaseWidthRatioDefault
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthRatio,
    widthMinPx:
      density === 'compact'
        ? typeof sizing?.overlayBaseWidthMinPxCompact === 'number' && Number.isFinite(sizing.overlayBaseWidthMinPxCompact)
          ? sizing.overlayBaseWidthMinPxCompact
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx
        : typeof sizing?.overlayBaseWidthMinPxDefault === 'number' && Number.isFinite(sizing.overlayBaseWidthMinPxDefault)
          ? sizing.overlayBaseWidthMinPxDefault
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMinPx,
    widthMaxPx:
      density === 'compact'
        ? typeof sizing?.overlayBaseWidthMaxPxCompact === 'number' && Number.isFinite(sizing.overlayBaseWidthMaxPxCompact)
          ? sizing.overlayBaseWidthMaxPxCompact
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx
        : typeof sizing?.overlayBaseWidthMaxPxDefault === 'number' && Number.isFinite(sizing.overlayBaseWidthMaxPxDefault)
          ? sizing.overlayBaseWidthMaxPxDefault
          : DEFAULT_OVERLAY_SIZING_CONFIG.widthMaxPx,
  })

  const fallback = computeOverlayHalfExtentsWorld({
    density,
    viewportW: args.viewportW,
    viewportH: args.viewportH ?? args.viewportW,
    zoomK: args.zoomK,
    config: overlayCfg,
  })

  const out: Record<string, NodeHalfExtents> = {}
  for (const id of ids) {
    const n = byId.get(id)
    if (!n) continue

    const props = (n as any)?.properties
    const rec = props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : null
    const wRaw = rec ? rec['visual:width'] : null
    const hRaw = rec ? rec['visual:height'] : null
    const w = typeof wRaw === 'number' && Number.isFinite(wRaw) && wRaw > 0 ? wRaw : NaN
    const h = typeof hRaw === 'number' && Number.isFinite(hRaw) && hRaw > 0 ? hRaw : NaN
    if (Number.isFinite(w) && Number.isFinite(h)) {
      out[id] = { halfW: Math.max(1, w / 2), halfH: Math.max(1, h / 2) }
    } else {
      out[id] = fallback
    }
  }

  return Object.keys(out).length > 0 ? out : null
}

