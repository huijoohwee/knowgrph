import { buildMarkdownTocTree, computeMarkdownTocReorder } from 'grph-shared/markdown/toc'

export function testMarkdownTocReorderRootAndNested() {
  const root = buildMarkdownTocTree([
    { id: 'a', text: 'A', depth: 1, index: 0, startLine: 1 },
    { id: 'b', text: 'B', depth: 1, index: 5, startLine: 5 },
    { id: 'c', text: 'C', depth: 2, index: 6, startLine: 6 },
    { id: 'd', text: 'D', depth: 2, index: 9, startLine: 9 },
  ])

  const aAfterB = computeMarkdownTocReorder({
    root,
    sourceId: 'a',
    targetId: 'b',
    position: 'after',
  })
  if (!aAfterB || aAfterB.parentId !== null || aAfterB.fromIndex !== 0 || aAfterB.toIndex !== 1) {
    throw new Error('expected root reorder a after b')
  }

  const bBeforeA = computeMarkdownTocReorder({
    root,
    sourceId: 'b',
    targetId: 'a',
    position: 'before',
  })
  if (!bBeforeA || bBeforeA.parentId !== null || bBeforeA.fromIndex !== 1 || bBeforeA.toIndex !== 0) {
    throw new Error('expected root reorder b before a')
  }

  const dBeforeC = computeMarkdownTocReorder({
    root,
    sourceId: 'd',
    targetId: 'c',
    position: 'before',
  })
  if (!dBeforeC || dBeforeC.parentId !== 'b' || dBeforeC.fromIndex !== 1 || dBeforeC.toIndex !== 0) {
    throw new Error('expected nested reorder d before c under b')
  }

  const differentParentRejected = computeMarkdownTocReorder({
    root,
    sourceId: 'c',
    targetId: 'a',
    position: 'after',
  })
  if (differentParentRejected !== null) {
    throw new Error('expected reorder across different parents to be rejected')
  }
}

