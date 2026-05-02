import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { expandMarkdownTocAncestors, useMarkdownTocFocusState } from '@/features/markdown/ui/useMarkdownTocFocusState'
import { TOC_FOCUS_EVENT } from '@/features/markdown/ui/tocFocusEvents'

export async function testUseMarkdownTocFocusStateCentralizesExplorerTocFocusState() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const parentById = new Map<string, string | null>([
    ['doc', null],
    ['child', 'doc'],
  ])
  const globalRecord = globalThis as typeof globalThis & { HTMLElement?: typeof HTMLElement }
  const cssRecord = globalThis as typeof globalThis & { CSS?: { escape?: (value: string) => string } }
  const previousHTMLElement = globalRecord.HTMLElement
  const previousCss = cssRecord.CSS
  const originalScrollIntoView = dom.window.HTMLElement.prototype.scrollIntoView
  let scrollCalls = 0

  globalRecord.HTMLElement = dom.window.HTMLElement
  cssRecord.CSS = { escape: value => String(value) }
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrollCalls += 1
  }

  function Harness(props: { resetKey: string | null }) {
    const navRef = React.useRef<HTMLElement | null>(null)
    const { activeItemId, collapsedIds, setActiveItemId, toggleExpanded } = useMarkdownTocFocusState({
      resetKey: props.resetKey,
      tocCollapsed: false,
      itemCount: 2,
      parentById,
      navRef,
    })

    return (
      <nav ref={navRef}>
        <button
          type="button"
          aria-label="toggle-doc"
          onClick={() => toggleExpanded('doc')}
        />
        <button
          type="button"
          aria-label="select-doc"
          onClick={() => setActiveItemId('doc')}
        />
        <button type="button" data-toc-id="child" />
        <span data-testid="active">{activeItemId}</span>
        <span data-testid="collapsed">{collapsedIds.has('doc') ? 'doc' : ''}</span>
      </nav>
    )
  }

  try {
    const expanded = expandMarkdownTocAncestors({
      collapsedIds: new Set(['doc']),
      parentById,
      itemId: 'child',
    })
    if (expanded.has('doc')) throw new Error('expected ancestor expansion helper to open doc for child')

    await act(async () => {
      root.render(React.createElement(Harness, { resetKey: 'a.md' }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const toggleButton = container.querySelector('button[aria-label="toggle-doc"]')
    if (!(toggleButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected TOC focus state harness toggle button')
    await act(async () => {
      toggleButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const collapsedBeforeFocus = container.querySelector('[data-testid="collapsed"]')?.textContent || ''
    if (collapsedBeforeFocus !== 'doc') throw new Error(`expected doc to be collapsed after toggle, got ${collapsedBeforeFocus}`)

    await act(async () => {
      dom.window.dispatchEvent(new dom.window.CustomEvent(TOC_FOCUS_EVENT, { detail: { id: 'child' } }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const activeAfterFocus = container.querySelector('[data-testid="active"]')?.textContent || ''
    const collapsedAfterFocus = container.querySelector('[data-testid="collapsed"]')?.textContent || ''
    if (activeAfterFocus !== 'child') throw new Error(`expected shared TOC focus hook to activate child, got ${activeAfterFocus}`)
    if (collapsedAfterFocus !== '') throw new Error(`expected shared TOC focus hook to expand doc ancestor, got ${collapsedAfterFocus}`)
    if (scrollCalls !== 1) throw new Error(`expected shared TOC focus hook to scroll focused row once, got ${String(scrollCalls)}`)

    await act(async () => {
      root.render(React.createElement(Harness, { resetKey: 'b.md' }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const activeAfterReset = container.querySelector('[data-testid="active"]')?.textContent || ''
    if (activeAfterReset !== '') throw new Error(`expected shared TOC focus hook to reset active item on reset key change, got ${activeAfterReset}`)
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
