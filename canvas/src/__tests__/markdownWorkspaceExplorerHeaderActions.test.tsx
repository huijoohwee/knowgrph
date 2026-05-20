import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceExplorerHeaderActions } from '@/features/markdown-workspace/MarkdownWorkspaceExplorerHeaderActions'

export async function testMarkdownWorkspaceExplorerHeaderActionsComposeSharedToolbarActions() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const calls: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceExplorerHeaderActions, {
          panelTextClass: 'text-xs',
          onRefresh: () => {
            calls.push('refresh')
          },
          search: '',
          setSearch: () => void 0,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const findButton = (label: string) =>
      Array.from(container.querySelectorAll('button')).find(
        node => String((node as HTMLButtonElement).getAttribute('aria-label') || '') === label,
      ) as HTMLButtonElement | undefined

    const newFileButton = findButton('New file')
    const clearButton = findButton('Clear')
    const deleteButton = findButton('Delete note.md')
    const refreshButton = findButton('Refresh')
    const searchButton = findButton('Show search')

    if (container.querySelector('details[aria-label="Explorer actions overflow"]')) {
      throw new Error('expected Explorer actions to reuse the inline scroll row instead of a three-dot overflow')
    }
    if (findButton('Actions for note.md')) {
      throw new Error('expected Explorer selection actions to render as direct icon buttons')
    }
    if (newFileButton) throw new Error('expected New file to live in the Source Files context menu, not the Explorer header')
    if (clearButton) throw new Error('expected Clear to live in the Source Files context menu, not the Explorer header')
    if (deleteButton) throw new Error('expected Delete to live in the Source Files context menu, not the Explorer header')
    if (findButton('Refresh note.md')) throw new Error('expected URL-backed refresh to consolidate into the single Refresh button')
    if (!refreshButton) throw new Error('expected workspace refresh button in explorer header actions')
    if (!searchButton) throw new Error('expected search toggle button in explorer header actions')

    refreshButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    if (calls.join(',') !== 'refresh') {
      throw new Error(`expected header action click order refresh, got ${calls.join(',')}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
