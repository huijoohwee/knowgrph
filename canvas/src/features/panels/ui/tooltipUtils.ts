export type TooltipPosition = { top: number; left: number }

export const computeTooltipPositionFromAnchor = (anchorEl: HTMLElement, offsetPx: number): TooltipPosition => {
  const r = anchorEl.getBoundingClientRect()
  return {
    top: Math.round(r.bottom + offsetPx),
    left: Math.round(r.left + r.width / 2),
  }
}

export const computeTooltipMaxWidthPx = (
  anchorEl: HTMLElement,
  opts: {
    maxWidthFromPrevSibling?: boolean
    maxWidthPx?: number
    defaultMaxWidthPx: number
  },
): number => {
  if (typeof opts.maxWidthPx === 'number') return Math.max(0, Math.round(opts.maxWidthPx))
  if (opts.maxWidthFromPrevSibling) {
    const prev = anchorEl.previousElementSibling as HTMLElement | null
    if (prev) {
      const pr = prev.getBoundingClientRect()
      return Math.max(0, Math.round(pr.width))
    }
  }
  return Math.max(0, Math.round(opts.defaultMaxWidthPx))
}

export const constrainTooltipPosition = (opts: {
  pos: TooltipPosition
  tooltipRect: DOMRect
  anchorRect: DOMRect
  viewportW: number
  viewportH: number
  paddingPx: number
  offsetPx: number
}): TooltipPosition => {
  const { pos, tooltipRect, anchorRect, viewportW, viewportH, paddingPx, offsetPx } = opts
  let nextLeft = pos.left
  let nextTop = pos.top

  if (tooltipRect.left < paddingPx) {
    nextLeft = Math.round(nextLeft + (paddingPx - tooltipRect.left))
  }
  if (tooltipRect.right > viewportW - paddingPx) {
    nextLeft = Math.round(nextLeft - (tooltipRect.right - (viewportW - paddingPx)))
  }
  if (tooltipRect.bottom > viewportH - paddingPx) {
    nextTop = Math.round(anchorRect.top - offsetPx - tooltipRect.height)
  }
  if (tooltipRect.top < paddingPx) {
    nextTop = paddingPx
  }

  return { left: nextLeft, top: nextTop }
}

export const getTooltipPortalTarget = (anchorEl: HTMLElement | null): HTMLElement => {
  const doc = anchorEl?.ownerDocument
  if (!doc) return document.body
  const fullscreenEl = doc.fullscreenElement
  if (fullscreenEl && anchorEl && fullscreenEl.contains(anchorEl)) {
    return fullscreenEl as unknown as HTMLElement
  }
  return doc.body
}

