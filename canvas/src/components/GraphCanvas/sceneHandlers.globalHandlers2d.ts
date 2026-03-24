import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { calcMouseGraphPosition, isNodePointerTarget } from '@/features/canvas/utils'

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>

export const attachGlobalHandlers = (args: {
  svgRef: RefObject<SVGSVGElement>
  svg: SvgSelection
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  selectNode: (id: string | null) => void
  enableEditorGestures?: boolean
  onCanvasShiftDoubleClick?: (args: { x: number; y: number; clientX: number; clientY: number }) => void
  hideTemp: () => void
  cancelPending: () => void
}): (() => void) => {
  const { svgRef, svg, tempLinkSelRef, linkDragRef, selectNode, enableEditorGestures, onCanvasShiftDoubleClick, hideTemp, cancelPending } = args
  svg.on('mousemove', (ev: MouseEvent) => {
    if (!tempLinkSelRef.current || !linkDragRef.current) return
    const p = calcMouseGraphPosition(svgRef, ev)
    tempLinkSelRef.current.attr('x2', p[0]).attr('y2', p[1])
  })

  svg.on('click', (ev: MouseEvent) => {
    if (typeof ev.button === 'number' && ev.button !== 0) return
    selectNode(null)
    cancelPending()
  })
  svg.on('dblclick', (ev: MouseEvent) => {
    const btn = (ev as unknown as { button?: unknown }).button
    if (typeof btn === 'number' && btn !== 0) return
    if (!enableEditorGestures) return
    if (!ev.shiftKey) return
    if (isNodePointerTarget(ev.target as HTMLElement | null)) return
    const p = calcMouseGraphPosition(svgRef, ev)
    if (!p) return
    try {
      onCanvasShiftDoubleClick?.({ x: p[0], y: p[1], clientX: ev.clientX, clientY: ev.clientY })
    } catch {
      void 0
    }
  })
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideTemp()
      cancelPending()
    }
  }

  const isEventOutsideSvg = (target: unknown): boolean => {
    const svgEl = svgRef.current
    if (!svgEl) return true
    const t = target as Node | null
    if (!t || typeof (svgEl as unknown as { contains?: unknown }).contains !== 'function') return true
    try {
      return !(svgEl as unknown as { contains: (n: Node) => boolean }).contains(t)
    } catch {
      return true
    }
  }

  const onDocPointerDown = (e: PointerEvent) => {
    if (!linkDragRef.current) return
    if (isNodePointerTarget(e.target as HTMLElement | null)) return
    hideTemp()
    cancelPending()
  }

  const onWinPointerUpOrCancel = (e: PointerEvent) => {
    if (!linkDragRef.current) return
    if (!isEventOutsideSvg(e.target)) return
    hideTemp()
    cancelPending()
  }

  const onWinBlur = () => {
    if (!linkDragRef.current) return
    hideTemp()
    cancelPending()
  }

  const onVisibility = () => {
    try {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        onWinBlur()
      }
    } catch {
      void 0
    }
  }

  const pointerDownOptions: AddEventListenerOptions = { capture: true }
  const pointerEndOptions: AddEventListenerOptions = { capture: true }
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('pointerdown', onDocPointerDown, pointerDownOptions)
  window.addEventListener('pointerup', onWinPointerUpOrCancel, pointerEndOptions)
  window.addEventListener('pointercancel', onWinPointerUpOrCancel, pointerEndOptions)
  window.addEventListener('blur', onWinBlur)
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  return () => {
    svg.on('mousemove', null)
    svg.on('click', null)
    svg.on('dblclick', null)
    window.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('pointerdown', onDocPointerDown, pointerDownOptions)
    window.removeEventListener('pointerup', onWinPointerUpOrCancel, pointerEndOptions)
    window.removeEventListener('pointercancel', onWinPointerUpOrCancel, pointerEndOptions)
    window.removeEventListener('blur', onWinBlur)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  }
}

