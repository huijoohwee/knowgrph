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
  tab?: 'inspector' | 'node' | 'chat' | 'geo' | 'discovery'
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

  const elementSupported = typeof Element !== 'undefined'
  const el = elementSupported && target instanceof Element ? target : null
  if (!el) {
    const tag = (() => {
      const x = target as unknown as { tagName?: unknown }
      return typeof x?.tagName === 'string' ? x.tagName.toLowerCase() : ''
    })()
    return tag === 'circle' || tag === 'rect' || tag === 'path' || tag === 'line' || tag === 'text' || tag === 'tspan' || tag === 'foreignobject'
  }

  const tag = String(el.tagName || '').toLowerCase()
  if (tag === 'circle' || tag === 'rect' || tag === 'path') return true

  if (el.closest('[data-kg-layer="nodes"]')) return true
  if (el.closest('[data-kg-layer="node-chevrons"]')) return true
  if (el.closest('[data-role="media-node-panel"]')) return true
  if (el.closest('[data-kg-layer="labels"]')) return true
  if (el.closest('[data-kg-layer="links-hit"]')) return true
  if (el.closest('[data-kg-layer="edge-labels"]')) return true
  if (el.closest('[data-kg-layer="groups"]')) return true
  if (el.closest('[data-kg-layer="group-labels"]')) return true

  if (tag === 'line' && el.closest('[data-kg-layer="links-hit"]')) return true
  if ((tag === 'text' || tag === 'tspan') && el.closest('[data-kg-layer]')) {
    const layer = el.closest('[data-kg-layer]')
    const id = String(layer?.getAttribute('data-kg-layer') || '')
    if (id === 'labels' || id === 'group-labels' || id === 'edge-labels') return true
  }
  if (tag === 'foreignobject' && el.closest('[data-role="media-node-panel"]')) return true

  return false
}
