import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceTocTreeItem } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceTocTreeItem'
import type { TocItem } from '@/features/markdown/ui/markdownSectionUtils'

export async function testMarkdownWorkspaceTocTreeItemOwnsExplorerTocItemWrapper() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const calls: string[] = []

  try {
    const item: TocItem = {
      id: 'intro',
      text: 'Introduction',
      depth: 2,
      line: 3,
      children: [{ id: 'child', text: 'Child', depth: 3, line: 5, children: [] }],
    }

    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceTocTreeItem, {
          item,
          depth: 1,
          headingNumber: '1.1',
          isExpanded: true,
          isActive: true,
          onToggleExpanded: id => {
            calls.push(`toggle:${id}`)
          },
          onSelect: id => {
            calls.push(`select:${id}`)
          },
          onReorder: () => void 0,
          uiPanelTextFontClass: 'font-sans',
          uiPanelKeyValueTextSizeClass: 'text-xs',
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const wrapper = container.querySelector('section[aria-label="Heading Introduction"]')
    if (!(wrapper instanceof dom.window.HTMLElement)) throw new Error('expected TOC item wrapper to render the explorer heading section')

    const rowButton = container.querySelector('button[data-toc-id="intro"]')
    if (!(rowButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected TOC item wrapper to render the TOC row button')
    rowButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    if (calls.join(',') !== 'select:intro,toggle:intro') {
      throw new Error(`expected TOC item wrapper click to select and toggle intro, got ${calls.join(',')}`)
    }

    const text = container.textContent || ''
    if (!text.includes('1.1')) throw new Error('expected TOC item wrapper to render the heading number')
    if (!text.includes('Introduction')) throw new Error('expected TOC item wrapper to render the heading text')
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
