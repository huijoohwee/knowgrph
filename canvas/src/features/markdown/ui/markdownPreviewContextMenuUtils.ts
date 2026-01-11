export type MarkdownSelectionRange = {
  startLine: number
  endLine: number
}

export type MarkdownPreviewMenuPosition = {
  x: number
  y: number
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
