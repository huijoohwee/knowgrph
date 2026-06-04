import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceTocTree } from '@/features/markdown-workspace/MarkdownWorkspaceTocTree'
import type { TocItem } from '@/features/markdown/ui/markdownSectionUtils'

export async function testMarkdownWorkspaceTocTreeOwnsExplorerTocRecursion() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const calls: string[] = []

  try {
    const items: TocItem[] = [
      {
        id: 'doc',
        text: 'Doc',
        depth: 1,
        index: 0,
        startLine: 1,
        children: [{ id: 'child', text: 'Child', depth: 2, index: 1, startLine: 3, children: [] }],
      },
    ]

    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceTocTree, {
          items,
          collapsedIds: new Set<string>(),
          activeItemId: 'child',
          headingNumbersById: new Map([
            ['doc', '1'],
            ['child', '1.1'],
          ]),
          baseDepth: 1,
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

    const buttons = container.querySelectorAll('button[data-toc-id]')
    if (buttons.length !== 2) throw new Error(`expected TOC tree to render 2 heading buttons, got ${String(buttons.length)}`)
    const activeButton = Array.from(buttons).find(node => String((node as HTMLButtonElement).getAttribute('data-toc-id') || '') === 'child') as
      | HTMLButtonElement
      | undefined
    if (!activeButton) throw new Error('expected TOC tree to render nested child heading button')

    activeButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    if (calls.join(',') !== 'select:child') {
      throw new Error(`expected leaf TOC item click to only select child, got ${calls.join(',')}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
