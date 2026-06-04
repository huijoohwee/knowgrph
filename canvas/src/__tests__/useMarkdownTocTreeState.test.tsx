import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useMarkdownTocTreeState } from '@/features/markdown/ui/useMarkdownTocTreeState'

export async function testUseMarkdownTocTreeStateCentralizesGenericTocTreeInteractions() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const reorderCalls: Array<{ parentId: string | null; fromIndex: number; toIndex: number }> = []
  const tocTokens = [
    { type: 'heading', depth: 1, id: 'doc', text: 'Doc', tokens: [], raw: '', startLine: 1, endLine: 1 },
    { type: 'heading', depth: 2, id: 'a', text: 'A', tokens: [], raw: '', startLine: 3, endLine: 3 },
    { type: 'heading', depth: 2, id: 'b', text: 'B', tokens: [], raw: '', startLine: 5, endLine: 5 },
  ] as unknown as import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[]

  function Harness() {
    const { items, onMoveItem, onReorderByIds } = useMarkdownTocTreeState({
      tokens: tocTokens,
      onReorder: (parentId, fromIndex, toIndex) => {
        reorderCalls.push({ parentId, fromIndex, toIndex })
      },
    })

    return (
      <section>
        <button type="button" aria-label="move-a-down" onClick={() => onMoveItem?.('a', 'down')} />
        <button type="button" aria-label="move-b-before-a" onClick={() => onReorderByIds?.('b', 'a', 'before')} />
        <span data-testid="root-count">{String(items.length)}</span>
        <span data-testid="first-root-id">{items[0]?.id || ''}</span>
      </section>
    )
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const rootCount = container.querySelector('[data-testid="root-count"]')?.textContent || ''
    const firstRootId = container.querySelector('[data-testid="first-root-id"]')?.textContent || ''
    if (rootCount !== '1') throw new Error(`expected one TOC root item, got ${rootCount}`)
    if (firstRootId !== 'doc') throw new Error(`expected doc as first TOC root, got ${firstRootId}`)

    const moveButton = container.querySelector('button[aria-label="move-a-down"]')
    if (!(moveButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected move button')
    await act(async () => {
      moveButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const moveResult = reorderCalls[0] || null
    if (!moveResult) throw new Error('expected move interaction to emit one reorder callback')
    if (moveResult.parentId !== 'doc' || moveResult.fromIndex !== 0 || moveResult.toIndex !== 1) {
      throw new Error(`expected move interaction doc/0/1, got ${JSON.stringify(moveResult)}`)
    }

    const reorderButton = container.querySelector('button[aria-label="move-b-before-a"]')
    if (!(reorderButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected reorder button')
    await act(async () => {
      reorderButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const reorderResult = reorderCalls[1] || null
    if (!reorderResult) throw new Error('expected reorder-by-id interaction to emit a second callback')
    if (reorderResult.parentId !== 'doc' || reorderResult.fromIndex !== 1 || reorderResult.toIndex !== 0) {
      throw new Error(`expected reorder interaction doc/1/0, got ${JSON.stringify(reorderResult)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
