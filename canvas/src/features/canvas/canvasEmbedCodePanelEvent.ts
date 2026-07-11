export const CANVAS_EMBED_CODE_PANEL_OPEN_EVENT = 'kg-canvas-embed-code-panel-open'

export type CanvasEmbedCodePanelDetail = {
  sourceName: string
  title: string
  language: string
  code: string
}

export function openCanvasEmbedCodePanel(detail: CanvasEmbedCodePanelDetail): boolean {
  const sourceName = String(detail.sourceName || '').trim()
  const title = String(detail.title || '').trim()
  const language = String(detail.language || '').trim()
  const code = String(detail.code || '').trim()
  if (!sourceName || !title || !language || !code || typeof window === 'undefined') return false
  const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
  window.dispatchEvent(new CustomEventCtor(CANVAS_EMBED_CODE_PANEL_OPEN_EVENT, {
    detail: { sourceName, title, language, code } satisfies CanvasEmbedCodePanelDetail,
  }))
  return true
}

export function readCanvasEmbedCodePanelDetail(event: Event): CanvasEmbedCodePanelDetail | null {
  const detail = (event as CustomEvent<Partial<CanvasEmbedCodePanelDetail>>).detail
  const sourceName = String(detail?.sourceName || '').trim()
  const title = String(detail?.title || '').trim()
  const language = String(detail?.language || '').trim()
  const code = String(detail?.code || '').trim()
  return sourceName && title && language && code ? { sourceName, title, language, code } : null
}
