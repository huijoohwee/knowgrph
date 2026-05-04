import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

export const clamp01 = (n: number) => {
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

export const getScrollRatio = (el: HTMLElement) => {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  if (max <= 0) return 0
  return clamp01(el.scrollTop / max)
}

export const getEditorScrollRatio = (h: MonacoTextEditorHandle) => {
  const max = Math.max(0, h.getScrollHeight() - h.getClientHeight())
  if (max <= 0) return 0
  return clamp01(h.getScrollTop() / max)
}

export const setScrollRatio = (el: HTMLElement, ratio: number) => {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  el.scrollTop = Math.round(clamp01(ratio) * max)
}

export const setEditorScrollRatio = (h: MonacoTextEditorHandle, ratio: number) => {
  const max = Math.max(0, h.getScrollHeight() - h.getClientHeight())
  h.setScrollTop(Math.round(clamp01(ratio) * max))
}

