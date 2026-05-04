import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useMarkdownTocModelState } from '@/features/markdown/ui/useMarkdownTocModelState'

export async function testUseMarkdownTocModelStateCentralizesExplorerTocModelGlue() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const revealCalls: number[] = []
  const reorderCalls: Array<{ parentId: string | null; fromIndex: number; toIndex: number }> = []
  const tocTokens = [
    { type: 'heading', depth: 1, id: 'doc', text: 'Doc', tokens: [], raw: '', startLine: 1, endLine: 1 },
    { type: 'heading', depth: 2, id: 'a', text: 'A', tokens: [], raw: '', startLine: 3, endLine: 3 },
    { type: 'heading', depth: 2, id: 'b', text: 'B', tokens: [], raw: '', startLine: 5, endLine: 5 },
  ] as unknown as import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[]
  const globalRecord = globalThis as typeof globalThis & { HTMLElement?: typeof HTMLElement }
  const cssRecord = globalThis as typeof globalThis & { CSS?: typeof CSS & { escape?: (value: string) => string } }
  const previousHTMLElement = globalRecord.HTMLElement
  const previousCss = cssRecord.CSS
  const originalScrollIntoView = dom.window.HTMLElement.prototype.scrollIntoView
  let scrollCalls = 0

  globalRecord.HTMLElement = dom.window.HTMLElement
  cssRecord.CSS = { escape: value => String(value) } as typeof CSS & { escape?: (value: string) => string }
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrollCalls += 1
  }

  function Harness(props: { resetKey: string | null; tocCollapsed: boolean }) {
    const {
      activeItemId,
      baseDepth,
      collapsedIds,
      headingNumberById,
      items,
      onNavRefChange,
      onReorderByIds,
      onSelectItem,
      toggleExpanded,
    } = useMarkdownTocModelState({
      resetKey: props.resetKey,
      tocCollapsed: props.tocCollapsed,
      tokens: tocTokens,
      onRevealLine: line => {
        revealCalls.push(line)
      },
      onReorder: (parentId, fromIndex, toIndex) => {
        reorderCalls.push({ parentId, fromIndex, toIndex })
      },
    })

    return (
      <nav ref={onNavRefChange}>
        <button type="button" aria-label="toggle-doc" onClick={() => toggleExpanded('doc')} />
        <button type="button" aria-label="select-b" onClick={() => onSelectItem('b')} />
        <button type="button" aria-label="move-b-before-a" onClick={() => onReorderByIds('b', 'a', 'before')} />
        <button type="button" data-toc-id="b" />
        <span data-testid="active">{activeItemId}</span>
        <span data-testid="collapsed">{collapsedIds.has('doc') ? 'doc' : ''}</span>
        <span data-testid="base-depth">{String(baseDepth)}</span>
        <span data-testid="root-count">{String(items.length)}</span>
        <span data-testid="hn-doc">{headingNumberById.get('doc') || ''}</span>
        <span data-testid="hn-b">{headingNumberById.get('b') || ''}</span>
      </nav>
    )
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness, { resetKey: 'a.md', tocCollapsed: false }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const baseDepth = container.querySelector('[data-testid="base-depth"]')?.textContent || ''
    const rootCount = container.querySelector('[data-testid="root-count"]')?.textContent || ''
    const docNumber = container.querySelector('[data-testid="hn-doc"]')?.textContent || ''
    const bNumber = container.querySelector('[data-testid="hn-b"]')?.textContent || ''
    if (baseDepth !== '1') throw new Error(`expected model state base depth 1, got ${baseDepth}`)
    if (rootCount !== '1') throw new Error(`expected one visible TOC root item, got ${rootCount}`)
    if (docNumber !== '1') throw new Error(`expected doc heading number 1, got ${docNumber}`)
    if (bNumber !== '1.2') throw new Error(`expected b heading number 1.2, got ${bNumber}`)

    const selectButton = container.querySelector('button[aria-label="select-b"]')
    if (!(selectButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected TOC model state select button')
    await act(async () => {
      selectButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const activeAfterSelect = container.querySelector('[data-testid="active"]')?.textContent || ''
    if (activeAfterSelect !== 'b') throw new Error(`expected TOC model state to activate b on select, got ${activeAfterSelect}`)
    if (revealCalls.join(',') !== '5') throw new Error(`expected TOC model state to reveal line 5, got ${revealCalls.join(',')}`)

    const moveButton = container.querySelector('button[aria-label="move-b-before-a"]')
    if (!(moveButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected TOC model state reorder button')
    await act(async () => {
      moveButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const firstMove = reorderCalls[0] || null
    if (!firstMove) throw new Error('expected TOC model state to emit one reorder callback')
    if (firstMove.parentId !== 'doc' || firstMove.fromIndex !== 1 || firstMove.toIndex !== 0) {
      throw new Error(`expected TOC model state reorder doc/1/0, got ${JSON.stringify(firstMove)}`)
    }

    const toggleButton = container.querySelector('button[aria-label="toggle-doc"]')
    if (!(toggleButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected TOC model state toggle button')
    await act(async () => {
      toggleButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const collapsedBeforeFocus = container.querySelector('[data-testid="collapsed"]')?.textContent || ''
    if (collapsedBeforeFocus !== 'doc') throw new Error(`expected doc to be collapsed before focus event, got ${collapsedBeforeFocus}`)

    await act(async () => {
      dom.window.dispatchEvent(new dom.window.CustomEvent('kg:tocFocus', { detail: { id: 'b' } }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const activeAfterFocus = container.querySelector('[data-testid="active"]')?.textContent || ''
    const collapsedAfterFocus = container.querySelector('[data-testid="collapsed"]')?.textContent || ''
    if (activeAfterFocus !== 'b') throw new Error(`expected TOC model state focus event to activate b, got ${activeAfterFocus}`)
    if (collapsedAfterFocus !== '') throw new Error(`expected TOC model state focus event to expand doc, got ${collapsedAfterFocus}`)
    if (scrollCalls !== 1) throw new Error(`expected TOC model state to scroll once after focus event, got ${String(scrollCalls)}`)

    await act(async () => {
      root.render(React.createElement(Harness, { resetKey: 'b.md', tocCollapsed: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const activeAfterReset = container.querySelector('[data-testid="active"]')?.textContent || ''
    const collapsedRootCount = container.querySelector('[data-testid="root-count"]')?.textContent || ''
    if (activeAfterReset !== '') throw new Error(`expected TOC model state reset to clear active item, got ${activeAfterReset}`)
    if (collapsedRootCount !== '0') throw new Error(`expected collapsed TOC model state to hide items, got ${collapsedRootCount}`)
  } finally {
    globalRecord.HTMLElement = previousHTMLElement
    cssRecord.CSS = previousCss
    dom.window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
