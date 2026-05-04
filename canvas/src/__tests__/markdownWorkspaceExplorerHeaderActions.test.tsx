import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceExplorerHeaderActions } from '@/features/markdown-workspace/MarkdownWorkspaceExplorerHeaderActions'
import type { SelectionActionItem } from '@/features/markdown-workspace/selectionActionItems'

export async function testMarkdownWorkspaceExplorerHeaderActionsComposeSharedToolbarActions() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const calls: string[] = []

  try {
    const selectionActionItems: SelectionActionItem[] = [
      {
        key: 'refresh',
        label: 'Refresh from URL',
        ariaLabel: 'Refresh note.md',
        onSelect: () => {
          calls.push('refresh-selection')
        },
      },
      {
        key: 'delete',
        label: 'Delete',
        ariaLabel: 'Delete note.md',
        onSelect: () => {
          calls.push('delete')
        },
      },
    ]

    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceExplorerHeaderActions, {
          textSizeClass: 'text-xs',
          panelTextClass: 'text-xs',
          activeEntryName: 'note.md',
          selectionActionItems,
          onCreateNewFile: () => {
            calls.push('new-file')
          },
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

    const actionsButton = findButton('Actions for note.md')
    const newFileButton = findButton('New file')
    const refreshSelectionButton = findButton('Refresh note.md')
    const refreshButton = findButton('Refresh')
    const searchButton = findButton('Show search')

    if (!actionsButton) throw new Error('expected selection actions trigger in explorer header actions')
    if (!newFileButton) throw new Error('expected new file button in explorer header actions')
    if (!refreshSelectionButton) throw new Error('expected selection refresh button in explorer header actions')
    if (!refreshButton) throw new Error('expected workspace refresh button in explorer header actions')
    if (!searchButton) throw new Error('expected search toggle button in explorer header actions')

    newFileButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    refreshSelectionButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    refreshButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    if (calls.join(',') !== 'new-file,refresh-selection,refresh') {
      throw new Error(`expected header action click order new-file,refresh-selection,refresh, got ${calls.join(',')}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
