import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownTocDropMarkers, MarkdownTocExpandGlyph, MarkdownTocReorderHandle } from '@/features/markdown/ui/MarkdownTocChrome'

export async function testMarkdownTocChromeCentralizesSharedTocRowUi() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let dragStarts = 0

  try {
    await act(async () => {
      root.render(
        React.createElement(
          'section',
          { className: 'group relative' },
          React.createElement(MarkdownTocDropMarkers, { dragState: 'top', showArrow: true }),
          React.createElement(MarkdownTocExpandGlyph, {
            isExpanded: false,
            className: 'w-3 h-3 shrink-0',
          }),
          React.createElement(MarkdownTocReorderHandle, {
            ariaLabel: 'Reorder item',
            title: 'Reorder item',
            className: 'handle',
            iconClassName: 'w-3 h-3',
            onDragStart: () => {
              dragStarts += 1
            },
            onDragEnd: () => void 0,
          }),
        ),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const topMarker = container.querySelector('.-top-1')
    if (!(topMarker instanceof dom.window.HTMLElement)) throw new Error('expected shared TOC chrome to render top drop marker')

    const rightChevron = container.querySelector('svg')
    if (!(rightChevron instanceof dom.window.SVGElement)) throw new Error('expected shared TOC chrome to render expand glyph')

    const handle = container.querySelector('button[aria-label="Reorder item"]')
    if (!(handle instanceof dom.window.HTMLButtonElement)) throw new Error('expected shared TOC chrome to render reorder handle')
    handle.dispatchEvent(new dom.window.Event('dragstart', { bubbles: true }))
    if (dragStarts !== 1) throw new Error(`expected TOC chrome drag handle to fire once, got ${String(dragStarts)}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
