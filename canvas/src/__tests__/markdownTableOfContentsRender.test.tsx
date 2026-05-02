import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownTableOfContents } from '@/features/markdown/ui/MarkdownTableOfContents'

export async function testMarkdownTableOfContentsRendersHeadings() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    const tokens = [
      { type: 'heading', depth: 1, id: 'doc', text: 'Doc', tokens: [], raw: '', startLine: 1, endLine: 1 },
      { type: 'heading', depth: 2, id: 'child', text: 'Child', tokens: [], raw: '', startLine: 3, endLine: 3 },
    ] as unknown as import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[]

    await act(async () => {
      root.render(
        React.createElement(MarkdownTableOfContents, {
          tokens,
          uiPanelTextFontClass: 'font-sans',
          uiPanelKeyValueTextSizeClass: 'text-xs',
          collapsedIds: new Set<string>(),
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const text = container.textContent || ''
    if (!text.includes('Doc')) throw new Error('expected TOC to render Doc heading')
    if (!text.includes('Child')) throw new Error('expected TOC to render Child heading')
    const rows = container.querySelectorAll('li')
    if (rows.length !== 2) throw new Error(`expected 2 TOC rows, got ${String(rows.length)}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
