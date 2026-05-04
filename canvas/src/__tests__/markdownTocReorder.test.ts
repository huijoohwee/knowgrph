import { applyMarkdownTocReorderByIds } from '@/features/markdown/ui/markdownTocReorder'
import type { TocItem } from '@/features/markdown/ui/markdownSectionUtils'

export async function testApplyMarkdownTocReorderByIdsCentralizesTocReorderBridge() {
  const root: TocItem[] = [
    { id: 'a', text: 'A', depth: 1, index: 0, startLine: 1, children: [] },
    {
      id: 'b',
      text: 'B',
      depth: 1,
      index: 1,
      startLine: 2,
      children: [{ id: 'b-1', text: 'B.1', depth: 2, index: 2, startLine: 3, children: [] }],
    },
    { id: 'c', text: 'C', depth: 1, index: 3, startLine: 4, children: [] },
  ]

  const moves: Array<{ parentId: string | null; fromIndex: number; toIndex: number }> = []
  const changed = applyMarkdownTocReorderByIds({
    root,
    sourceId: 'c',
    targetId: 'a',
    position: 'before',
    onReorder: (parentId, fromIndex, toIndex) => {
      moves.push({ parentId, fromIndex, toIndex })
    },
  })

  if (!changed) throw new Error('expected reorder helper to report a valid top-level move')
  if (moves.length !== 1) throw new Error(`expected one top-level reorder callback, got ${String(moves.length)}`)
  if (moves[0]?.parentId !== null || moves[0]?.fromIndex !== 2 || moves[0]?.toIndex !== 0) {
    throw new Error(`expected top-level move null/2/0, got ${JSON.stringify(moves[0] || null)}`)
  }

  const nestedMoves: Array<{ parentId: string | null; fromIndex: number; toIndex: number }> = []
  const nestedChanged = applyMarkdownTocReorderByIds({
    root,
    sourceId: 'missing',
    targetId: 'b-1',
    position: 'after',
    onReorder: (parentId, fromIndex, toIndex) => {
      nestedMoves.push({ parentId, fromIndex, toIndex })
    },
  })

  if (nestedChanged) throw new Error('expected reorder helper to ignore invalid source ids')
  if (nestedMoves.length !== 0) throw new Error(`expected no reorder callbacks for invalid move, got ${String(nestedMoves.length)}`)
}
