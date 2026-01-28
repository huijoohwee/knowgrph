import { buildMarkdownTocTree, computeMarkdownTocMove } from 'grph-shared/markdown/toc'

export function testMarkdownTocMoveRootAndNested() {
  const root = buildMarkdownTocTree([
    { id: 'a', text: 'A', depth: 1, index: 0, startLine: 1 },
    { id: 'b', text: 'B', depth: 1, index: 5, startLine: 5 },
    { id: 'c', text: 'C', depth: 2, index: 6, startLine: 6 },
    { id: 'd', text: 'D', depth: 2, index: 9, startLine: 9 },
  ])

  const aDown = computeMarkdownTocMove({ root, id: 'a', direction: 'down' })
  if (!aDown || aDown.parentId !== null || aDown.fromIndex !== 0 || aDown.toIndex !== 1) {
    throw new Error('expected root move down for a')
  }

  const bUp = computeMarkdownTocMove({ root, id: 'b', direction: 'up' })
  if (!bUp || bUp.parentId !== null || bUp.fromIndex !== 1 || bUp.toIndex !== 0) {
    throw new Error('expected root move up for b')
  }

  const cDown = computeMarkdownTocMove({ root, id: 'c', direction: 'down' })
  if (!cDown || cDown.parentId !== 'b' || cDown.fromIndex !== 0 || cDown.toIndex !== 1) {
    throw new Error('expected nested move down for c under b')
  }

  const dUp = computeMarkdownTocMove({ root, id: 'd', direction: 'up' })
  if (!dUp || dUp.parentId !== 'b' || dUp.fromIndex !== 1 || dUp.toIndex !== 0) {
    throw new Error('expected nested move up for d under b')
  }
}
