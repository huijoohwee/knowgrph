export const MARKDOWN_EDIT_SURFACE_INTERACTION_PARITY_CLASS =
  '[caret-color:inherit] focus:outline-none focus-visible:outline-none'

export const MARKDOWN_CONTENT_EDITABLE_PLACEHOLDER_CLASS =
  'before:pointer-events-none before:italic before:text-[color:var(--kg-text-tertiary)] before:content-[attr(aria-placeholder)]'

export type MarkdownContentEditablePoint = {
  x: number
  y: number
}

export type MarkdownContentEditableCaretRange = {
  range: Range | null
  supported: boolean
}

const isRangeInsideRoot = (root: HTMLElement, range: Range): boolean => {
  const node = range.startContainer
  return node === root || root.contains(node)
}

export function readMarkdownContentEditableCaretRangeFromPoint(
  root: HTMLElement,
  point: MarkdownContentEditablePoint,
): MarkdownContentEditableCaretRange {
  const ownerDocument = root.ownerDocument
  const pointDocument = ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const hasPositionApi = typeof pointDocument.caretPositionFromPoint === 'function'
  const hasRangeApi = typeof pointDocument.caretRangeFromPoint === 'function'
  const supported = hasPositionApi || hasRangeApi
  try {
    if (hasPositionApi) {
      const position = pointDocument.caretPositionFromPoint?.(point.x, point.y) || null
      if (!position) return { range: null, supported }
      const range = ownerDocument.createRange()
      range.setStart(position.offsetNode, position.offset)
      range.collapse(true)
      return { range: isRangeInsideRoot(root, range) ? range : null, supported }
    }
    if (hasRangeApi) {
      const range = pointDocument.caretRangeFromPoint?.(point.x, point.y) || null
      return { range: range && isRangeInsideRoot(root, range) ? range : null, supported }
    }
  } catch {
    return { range: null, supported }
  }
  return { range: null, supported }
}

export function applyMarkdownContentEditableSelection(
  root: HTMLElement,
  range: Range,
  options?: { focus?: boolean },
): boolean {
  const selection = root.ownerDocument.defaultView?.getSelection()
  if (!selection) return false
  if (options?.focus !== false) root.focus({ preventScroll: true })
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}
