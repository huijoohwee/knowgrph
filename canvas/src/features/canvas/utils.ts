import * as d3 from 'd3'

export const PROPS_PANEL_OPEN_EVENT = 'kg:propsPanelOpen' as const
export const RENDERER_PANEL_OPEN_EVENT = 'kg:rendererPanelOpen' as const
export const RENDERER_FLOATING_PANEL_OPEN_EVENT = 'kg:floatingPanelOpen:renderer' as const
export const SIDE_PANEL_OPEN_EVENT = 'kg:sidePanelOpen' as const
export const CHAT_INPUT_APPEND_EVENT = 'kg:chatInputAppend' as const

export type PropsPanelOpenEventDetail = {
  clientX?: number
  clientY?: number
}

export type SidePanelOpenEventDetail = {
  tab?: 'node' | 'chat'
  open?: boolean
}

export type ChatInputAppendEventDetail = {
  text?: string
  mode?: 'append' | 'replace'
}

export function emitPropsPanelOpen(detail?: PropsPanelOpenEventDetail): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent<PropsPanelOpenEventDetail>(PROPS_PANEL_OPEN_EVENT, { detail }))
  } catch {
    void 0
  }
}

export function emitSidePanelOpen(detail?: SidePanelOpenEventDetail): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent<SidePanelOpenEventDetail>(SIDE_PANEL_OPEN_EVENT, { detail }))
  } catch {
    void 0
  }
}

export function emitChatInputAppend(detail?: ChatInputAppendEventDetail): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent<ChatInputAppendEventDetail>(CHAT_INPUT_APPEND_EVENT, { detail }))
  } catch {
    void 0
  }
}

export function emitRendererPanelOpen(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(RENDERER_PANEL_OPEN_EVENT))
    window.dispatchEvent(new Event(RENDERER_FLOATING_PANEL_OPEN_EVENT))
  } catch {
    void 0
  }
}

export function calcMouseGraphPosition(svgRef: React.RefObject<SVGSVGElement>, ev: { offsetX: number; offsetY: number }): [number, number] {
  const t = d3.zoomTransform(svgRef.current as SVGSVGElement)
  const p = t.invert([ev.offsetX, ev.offsetY])
  return [p[0], p[1]]
}

export function isNodePointerTarget(target: EventTarget | null): boolean {
  if (!target) return false
  if (typeof SVGCircleElement !== 'undefined' && target instanceof SVGCircleElement) return true
  if (typeof SVGRectElement !== 'undefined' && target instanceof SVGRectElement) return true
  if (typeof SVGPathElement !== 'undefined' && target instanceof SVGPathElement) return true
  const tag = (() => {
    const el = target as unknown as { tagName?: unknown }
    return typeof el?.tagName === 'string' ? el.tagName.toLowerCase() : ''
  })()
  if ((typeof Element !== 'undefined' && target instanceof Element) || tag) {
    const t = tag || String((target as Element).tagName || '').toLowerCase()
    return t === 'circle' || t === 'rect' || t === 'path'
  }
  return false
}
