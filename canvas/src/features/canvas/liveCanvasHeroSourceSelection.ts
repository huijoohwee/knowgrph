import { normalizeLiveCanvasHeroCanvasEmbedUrl } from '@/features/canvas/canvasEmbedPresets'

export const LIVE_CANVAS_HERO_SOURCE_SELECT_EVENT = 'kg-live-canvas-hero-source-select'
const LIVE_CANVAS_HERO_SOURCE_SESSION_KEY = 'kg-live-canvas-hero-source/v3'

export type LiveCanvasHeroSourceSelection = {
  sourcePath: string
  embedUrl: string
}

function normalizeLiveCanvasHeroSourceSelection(value: Partial<LiveCanvasHeroSourceSelection> | null | undefined): LiveCanvasHeroSourceSelection | null {
  const sourcePath = String(value?.sourcePath || '').trim()
  const embedUrl = normalizeLiveCanvasHeroCanvasEmbedUrl(String(value?.embedUrl || '').trim())
  if (!sourcePath || !embedUrl) return null
  return { sourcePath, embedUrl }
}

export function readLiveCanvasHeroSourceSelection(event: Event): LiveCanvasHeroSourceSelection | null {
  return normalizeLiveCanvasHeroSourceSelection((event as CustomEvent<Partial<LiveCanvasHeroSourceSelection>>).detail)
}

export function readPersistedLiveCanvasHeroSourceSelection(): LiveCanvasHeroSourceSelection | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage?.getItem(LIVE_CANVAS_HERO_SOURCE_SESSION_KEY)
    if (!raw) return null
    return normalizeLiveCanvasHeroSourceSelection(JSON.parse(raw) as Partial<LiveCanvasHeroSourceSelection>)
  } catch {
    return null
  }
}

function persistLiveCanvasHeroSourceSelection(selection: LiveCanvasHeroSourceSelection): void {
  try {
    window.sessionStorage?.setItem(LIVE_CANVAS_HERO_SOURCE_SESSION_KEY, JSON.stringify(selection))
  } catch {
    void 0
  }
}

export function selectLiveCanvasHeroSource(selection: LiveCanvasHeroSourceSelection): boolean {
  const normalized = normalizeLiveCanvasHeroSourceSelection(selection)
  if (!normalized || typeof window === 'undefined') return false
  persistLiveCanvasHeroSourceSelection(normalized)
  const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
  window.dispatchEvent(new CustomEventCtor(LIVE_CANVAS_HERO_SOURCE_SELECT_EVENT, {
    detail: normalized satisfies LiveCanvasHeroSourceSelection,
  }))
  return true
}
