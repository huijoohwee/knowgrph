import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownTocTreeRow } from '@/features/markdown-workspace/MarkdownTocTreeRow'

export async function testMarkdownTocTreeRowUsesSharedExplorerTocShell() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let rowClicks = 0
  let dragStarts = 0

  try {
    await act(async () => {
      root.render(
        React.createElement(
          'section',
          { className: 'group flex items-center relative' },
          React.createElement(MarkdownTocTreeRow, {
            itemId: 'intro',
            text: 'Introduction',
            headingNumber: '1',
            indent: 12,
            hasChildren: true,
            isExpanded: true,
            isActive: true,
            isDragging: false,
            dragState: 'top',
            uiPanelTextFontClass: 'font-sans',
            uiPanelKeyValueTextSizeClass: 'text-xs',
            onClick: () => {
              rowClicks += 1
            },
            onDragStart: () => {
              dragStarts += 1
            },
            onDragEnd: () => void 0,
          }),
        ),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const rowButton = container.querySelector('button[data-toc-id="intro"]')
    if (!(rowButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected TOC row shell to render the heading button')
    if (rowButton.getAttribute('aria-label') !== 'Heading Introduction') throw new Error(`expected heading aria-label, got ${String(rowButton.getAttribute('aria-label') || '')}`)
    if (!String(rowButton.className || '').includes('flex-1')) throw new Error(`expected shared TOC row shell classes, got ${String(rowButton.className || '')}`)

    rowButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    if (rowClicks !== 1) throw new Error(`expected TOC row click once, got ${String(rowClicks)}`)

    const dragHandle = container.querySelector('button[aria-label="Reorder heading"]')
    if (!(dragHandle instanceof dom.window.HTMLButtonElement)) throw new Error('expected TOC row shell to render the reorder handle')
    const dragHandleClassName = String(dragHandle.className || '')
    if (!dragHandleClassName.includes('opacity-100') || dragHandleClassName.includes('opacity-0') || dragHandleClassName.includes('group-hover:opacity-100')) {
      throw new Error(`expected Explorer TOC reorder handle to stay visible without hover, got ${dragHandleClassName}`)
    }
    dragHandle.dispatchEvent(new dom.window.Event('dragstart', { bubbles: true }))
    if (dragStarts !== 1) throw new Error(`expected TOC reorder drag start once, got ${String(dragStarts)}`)

    const text = container.textContent || ''
    if (!text.includes('1')) throw new Error('expected TOC row shell to render the heading number')
    if (!text.includes('Introduction')) throw new Error('expected TOC row shell to render the heading text')
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
