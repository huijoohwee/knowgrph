export type MarkdownHeadingInfo = {
  id: string
  text: string
  depth: number
  index: number
  startLine: number
}

export type MarkdownTocItem = {
  id: string
  text: string
  depth: number
  index: number
  startLine: number
  children: MarkdownTocItem[]
}

export function buildMarkdownTocTree(headings: MarkdownHeadingInfo[]): MarkdownTocItem[] {
  const root: MarkdownTocItem[] = []
  const stack: MarkdownTocItem[] = []

  for (const h of headings) {
    const id = String(h.id || '').trim()
    if (!id) continue
    const text = String(h.text || '')
    const depth = Math.min(6, Math.max(1, Math.floor(h.depth || 1)))
    const index = Math.max(0, Math.floor(h.index || 0))
    const startLine = Math.max(0, Math.floor(h.startLine || 0))
    const item: MarkdownTocItem = {
      id,
      text,
      depth,
      index,
      startLine,
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(item)
    } else {
      stack[stack.length - 1].children.push(item)
    }
    stack.push(item)
  }

  return root
}

export function findMarkdownTocParent(
  items: MarkdownTocItem[],
  id: string,
): { parent: MarkdownTocItem | null; siblings: MarkdownTocItem[]; index: number } | null {
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].id === id) {
      return { parent: null, siblings: items, index: i }
    }
    const found = findMarkdownTocParent(items[i].children, id)
    if (found) {
      if (found.parent === null) {
        return { parent: items[i], siblings: items[i].children, index: found.index }
      }
      return found
    }
  }
  return null
}

export function computeMarkdownTocMove(args: {
  root: MarkdownTocItem[]
  id: string
  direction: 'up' | 'down'
}): { parentId: string | null; fromIndex: number; toIndex: number } | null {
  const info = findMarkdownTocParent(args.root, args.id)
  if (!info) return null
  const fromIndex = info.index
  const toIndex = args.direction === 'up' ? fromIndex - 1 : fromIndex + 1
  if (toIndex < 0 || toIndex >= info.siblings.length) return null
  return {
    parentId: info.parent ? info.parent.id : null,
    fromIndex,
    toIndex,
  }
}

export function computeMarkdownTocReorder(args: {
  root: MarkdownTocItem[]
  sourceId: string
  targetId: string
  position: 'before' | 'after'
}): { parentId: string | null; fromIndex: number; toIndex: number } | null {
  const sourceInfo = findMarkdownTocParent(args.root, args.sourceId)
  const targetInfo = findMarkdownTocParent(args.root, args.targetId)
  if (!sourceInfo || !targetInfo) return null

  const sourceParentId = sourceInfo.parent ? sourceInfo.parent.id : null
  const targetParentId = targetInfo.parent ? targetInfo.parent.id : null
  if (sourceParentId !== targetParentId) return null

  const siblings = sourceInfo.siblings
  if (siblings.length !== targetInfo.siblings.length) return null

  const fromIndex = sourceInfo.index
  let toIndex = targetInfo.index + (args.position === 'after' ? 1 : 0)
  if (fromIndex < toIndex) {
    toIndex -= 1
  }
  if (toIndex < 0) toIndex = 0
  if (toIndex >= siblings.length) toIndex = siblings.length - 1
  if (toIndex === fromIndex) return null

  return {
    parentId: sourceParentId,
    fromIndex,
    toIndex,
  }
}
