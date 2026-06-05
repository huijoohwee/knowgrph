import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceTocList } from '@/features/markdown-workspace/MarkdownWorkspaceTocList'
import type { TocItem } from '@/features/markdown/ui/markdownSectionUtils'

export async function testMarkdownWorkspaceTocListOwnsExplorerTocSectionBody() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceTocList, {
          items: [],
          panelTextClass: 'text-xs',
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (!(container.textContent || '').includes('No headings.')) {
      throw new Error('expected TOC list to render the explorer empty state')
    }
    if (!container.querySelector('.kg-markdown-workspace-explorer-empty-state')) {
      throw new Error('expected TOC empty state to use the shared Explorer empty-state owner')
    }

    const items: TocItem[] = [
      { id: 'doc', text: 'Doc', depth: 1, index: 0, startLine: 1, children: [] },
      { id: 'child', text: 'Child', depth: 2, index: 1, startLine: 3, children: [] },
    ]

    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceTocList, {
          items,
          panelTextClass: 'text-xs',
        }, items.map(item => React.createElement('li', { key: item.id }, item.text))),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const nav = container.querySelector('nav[aria-label="Table of contents"]')
    if (!(nav instanceof dom.window.HTMLElement)) throw new Error('expected TOC list to render the TOC navigation container')
    if (!nav.className.includes('kg-markdown-workspace-explorer-list') || nav.className.includes('overflow-auto')) {
      throw new Error(`expected TOC navigation to use the shared Explorer list owner without a nested scroll class, got ${JSON.stringify(nav.className)}`)
    }
    const rows = container.querySelectorAll('li')
    if (rows.length !== 2) throw new Error(`expected 2 TOC root rows, got ${String(rows.length)}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
