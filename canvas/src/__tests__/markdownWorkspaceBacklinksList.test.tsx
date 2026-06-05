import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceBacklinksList } from '@/features/markdown-workspace/MarkdownWorkspaceBacklinksList'

export async function testMarkdownWorkspaceBacklinksListOwnsExplorerBacklinksSectionBody() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const opened: Array<{ path: string; line: number }> = []

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceBacklinksList, {
          activePath: 'docs/current.md',
          backlinks: [],
          textSizeClass: 'text-xs',
          panelTextClass: 'text-xs',
          onOpenBacklink: args => {
            opened.push(args)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (!(container.textContent || '').includes('No backlinks.')) {
      throw new Error('expected backlinks list to render the explorer empty state')
    }
    if (!container.querySelector('.kg-markdown-workspace-explorer-empty-state')) {
      throw new Error('expected backlinks empty state to use the shared Explorer empty-state owner')
    }

    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceBacklinksList, {
          activePath: 'docs/current.md',
          backlinks: [
            { fromPath: 'notes/a.md', line: 3, lineText: 'See [[current]]' },
            { fromPath: 'notes/b.md', line: 9, lineText: '[current](docs/current.md)' },
          ],
          textSizeClass: 'text-xs',
          panelTextClass: 'text-xs',
          onOpenBacklink: args => {
            opened.push(args)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const nav = container.querySelector('nav[aria-label="Backlinks"]')
    if (!(nav instanceof dom.window.HTMLElement)) throw new Error('expected backlinks list to render the shared Explorer list container')
    if (!nav.className.includes('kg-markdown-workspace-explorer-list') || nav.className.includes('overflow-auto')) {
      throw new Error(`expected backlinks navigation to use the shared Explorer list owner without a nested scroll class, got ${JSON.stringify(nav.className)}`)
    }
    const buttons = container.querySelectorAll('button')
    if (buttons.length !== 2) throw new Error(`expected 2 backlink rows, got ${String(buttons.length)}`)
    buttons[0]?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    if (opened.length !== 1) throw new Error(`expected first backlink click once, got ${String(opened.length)}`)
    if (opened[0]?.path !== 'notes/a.md' || opened[0]?.line !== 3) {
      throw new Error(`expected backlink open args for notes/a.md:3, got ${JSON.stringify(opened[0] || null)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
