export type OverlayVerticalPlacement = 'bottom' | 'top'

export function readOverlayElementSize(container: HTMLElement | null): { width: number; height: number } {
  if (!container) return { width: 1, height: 1 }
  const containerRect = container.getBoundingClientRect()
  const child = container.firstElementChild
  const childRect = child && typeof child.getBoundingClientRect === 'function' ? child.getBoundingClientRect() : null
  const childElement = child instanceof HTMLElement ? child : null
  return {
    width: Math.max(1, containerRect.width || 0, childRect?.width || 0, container.scrollWidth || 0, childElement?.scrollWidth || 0),
    height: Math.max(1, containerRect.height || 0, childRect?.height || 0, container.scrollHeight || 0, childElement?.scrollHeight || 0),
  }
}

export function resolveOverlayVerticalTop(args: {
  anchorRect: { top: number; bottom: number }
  overlayHeight: number
  viewportHeight: number
  margin: number
  preferredPlacement: OverlayVerticalPlacement
}): number {
  const overlayHeight = Number.isFinite(args.overlayHeight) ? Math.max(1, args.overlayHeight) : 1
  const margin = Number.isFinite(args.margin) ? Math.max(0, args.margin) : 0
  const viewportHeight = Number.isFinite(args.viewportHeight) ? Math.max(1, args.viewportHeight) : 1
  const spaceBelow = Math.max(0, viewportHeight - args.anchorRect.bottom - margin)
  const spaceAbove = Math.max(0, args.anchorRect.top - margin)
  const wantsBottom = args.preferredPlacement === 'bottom'
  const openAbove = wantsBottom
    ? overlayHeight > spaceBelow && spaceAbove > spaceBelow
    : !(overlayHeight > spaceAbove && spaceBelow > spaceAbove)

  return openAbove
    ? args.anchorRect.top - margin - overlayHeight
    : args.anchorRect.bottom + margin
}
