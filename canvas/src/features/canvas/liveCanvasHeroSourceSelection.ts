export const LIVE_CANVAS_HERO_SOURCE_SELECT_EVENT = 'kg-live-canvas-hero-source-select'

export type LiveCanvasHeroSourceSelection = {
  sourcePath: string
  embedUrl: string
}

export function readLiveCanvasHeroSourceSelection(event: Event): LiveCanvasHeroSourceSelection | null {
  const detail = (event as CustomEvent<Partial<LiveCanvasHeroSourceSelection>>).detail
  const sourcePath = String(detail?.sourcePath || '').trim()
  const embedUrl = String(detail?.embedUrl || '').trim()
  if (!sourcePath || !embedUrl) return null
  return { sourcePath, embedUrl }
}

export function selectLiveCanvasHeroSource(selection: LiveCanvasHeroSourceSelection): boolean {
  const sourcePath = String(selection.sourcePath || '').trim()
  const embedUrl = String(selection.embedUrl || '').trim()
  if (!sourcePath || !embedUrl || typeof window === 'undefined') return false
  const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
  window.dispatchEvent(new CustomEventCtor(LIVE_CANVAS_HERO_SOURCE_SELECT_EVENT, {
    detail: { sourcePath, embedUrl } satisfies LiveCanvasHeroSourceSelection,
  }))
  return true
}
