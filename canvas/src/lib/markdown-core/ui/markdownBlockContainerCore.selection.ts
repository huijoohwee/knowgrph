export const getSelectionOffsetsWithin = (root: HTMLElement): { startOffset: number; endOffset: number } | null => {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  if (!sel || sel.rangeCount <= 0) return null
  const range = sel.getRangeAt(0)
  const container = range.commonAncestorContainer
  const node = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
  if (!node || !root.contains(node)) return null

  const startRange = range.cloneRange()
  startRange.selectNodeContents(root)
  try {
    startRange.setEnd(range.startContainer, range.startOffset)
  } catch {
    return null
  }

  const endRange = range.cloneRange()
  endRange.selectNodeContents(root)
  try {
    endRange.setEnd(range.endContainer, range.endOffset)
  } catch {
    return null
  }

  const startOffset = startRange.toString().length
  const endOffset = endRange.toString().length
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return null
  return { startOffset: Math.max(0, startOffset), endOffset: Math.max(0, endOffset) }
}

export const setSelectionByOffsetsWithin = (root: HTMLElement, args: { startOffset: number; endOffset: number }): void => {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  if (!sel) return

  const start = Math.max(0, Math.min(args.startOffset, args.endOffset))
  const end = Math.max(0, Math.max(args.startOffset, args.endOffset))
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  let currentNode: Text | null = null
  let currentOffset = 0
  let startNode: Text | null = null
  let startNodeOffset = 0
  let endNode: Text | null = null
  let endNodeOffset = 0

  while ((currentNode = walker.nextNode() as Text | null)) {
    const len = currentNode.nodeValue?.length ?? 0
    const nextOffset = currentOffset + len

    if (!startNode && start <= nextOffset) {
      startNode = currentNode
      startNodeOffset = Math.max(0, start - currentOffset)
    }
    if (!endNode && end <= nextOffset) {
      endNode = currentNode
      endNodeOffset = Math.max(0, end - currentOffset)
    }
    if (startNode && endNode) break
    currentOffset = nextOffset
  }

  if (!startNode) {
    const text = root.textContent || ''
    root.textContent = text
    startNode = root.firstChild as Text | null
    startNodeOffset = 0
  }
  if (!endNode) {
    const text = root.textContent || ''
    root.textContent = text
    endNode = root.firstChild as Text | null
    endNodeOffset = (endNode?.nodeValue?.length ?? 0)
  }
  if (!startNode || !endNode) return

  const range = document.createRange()
  range.setStart(startNode, Math.max(0, Math.min(startNodeOffset, startNode.nodeValue?.length ?? 0)))
  range.setEnd(endNode, Math.max(0, Math.min(endNodeOffset, endNode.nodeValue?.length ?? 0)))
  try {
    sel.removeAllRanges()
    sel.addRange(range)
  } catch {
    void 0
  }
}

