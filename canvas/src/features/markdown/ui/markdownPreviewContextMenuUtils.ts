export type MarkdownSelectionRange = {
  startLine: number
  endLine: number
}

export type MarkdownPreviewMenuPosition = {
  x: number
  y: number
}

export const findLineRangeFromTarget = (
  root: HTMLDivElement | null,
  target: EventTarget | null,
): MarkdownSelectionRange | null => {
  if (!root) return null
  const element = target as HTMLElement | null
  if (!element) return null
  let el: HTMLElement | null = element
  let startLine: number | null = null
  let endLine: number | null = null
  while (el && el !== root) {
    const ds = el.dataset
    if (ds && ds.startLine) {
      const s = Number.parseInt(ds.startLine, 10)
      const eLine = ds.endLine ? Number.parseInt(ds.endLine, 10) : s
      if (Number.isFinite(s) && Number.isFinite(eLine)) {
        startLine = s
        endLine = eLine
        break
      }
    }
    el = el.parentElement
  }
  if (startLine == null || endLine == null) return null
  return { startLine, endLine }
}

export function computeMarkdownPreviewMenuPosition(args: {
  containerRect: DOMRect
  clientX: number
  clientY: number
  clampToContainer?: boolean
  selectionBlockRect?: DOMRect | null
  biasToSelectionBlock?: boolean
}): MarkdownPreviewMenuPosition {
  const {
    containerRect,
    clientX,
    clientY,
    clampToContainer = false,
    selectionBlockRect,
    biasToSelectionBlock = false,
  } = args

  let x = clientX - containerRect.left
  let y = clientY - containerRect.top

  if (biasToSelectionBlock && selectionBlockRect) {
    const blockMidX = selectionBlockRect.left + selectionBlockRect.width / 2
    const blockMidY = selectionBlockRect.top + selectionBlockRect.height / 2
    x = blockMidX - containerRect.left
    y = blockMidY - containerRect.top
  }

  if (clampToContainer) {
    const menuWidth = 180
    const menuHeight = 36
    x = Math.max(0, Math.min(x, containerRect.width - menuWidth))
    y = Math.max(0, Math.min(y, containerRect.height - menuHeight))
  }

  return { x, y }
}
