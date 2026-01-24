import type { Map as MapLibreMap } from 'maplibre-gl'

type Handler = { enable?: () => void; disable?: () => void }

const applyHandler = (h: Handler | undefined, enabled: boolean) => {
  if (!h) return
  try {
    if (enabled) h.enable?.()
    else h.disable?.()
  } catch {
    void 0
  }
}

export function setMapInteractionEnabled(map: MapLibreMap, enabled: boolean) {
  applyHandler((map as unknown as { dragPan?: Handler }).dragPan, enabled)
  applyHandler((map as unknown as { scrollZoom?: Handler }).scrollZoom, enabled)
  applyHandler((map as unknown as { touchZoomRotate?: Handler }).touchZoomRotate, enabled)
  applyHandler((map as unknown as { doubleClickZoom?: Handler }).doubleClickZoom, enabled)
  applyHandler((map as unknown as { boxZoom?: Handler }).boxZoom, enabled)
  applyHandler((map as unknown as { keyboard?: Handler }).keyboard, enabled)
}

