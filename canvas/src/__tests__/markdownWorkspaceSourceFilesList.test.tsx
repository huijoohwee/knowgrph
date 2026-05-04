import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceSourceFilesList } from '@/features/markdown-workspace/MarkdownWorkspaceSourceFilesList'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'

export async function testMarkdownWorkspaceSourceFilesListOwnsExplorerSourceFilesSectionBody() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const clicks: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceSourceFilesList, {
          loading: true,
          loadError: '',
          textSizeClass: 'text-xs',
          entries: [],
          expandedPaths: new Set<string>(),
          activePath: null,
          toggleExpanded: () => void 0,
          onSelectFile: () => void 0,
          onSelectFolder: () => void 0,
          sourcesByPath: null,
          onRevealInFinder: () => void 0,
          onRenameEntry: () => void 0,
          onDeleteEntry: () => void 0,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (!(container.textContent || '').includes('Loading…')) {
      throw new Error('expected source files list to render loading state')
    }

    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceSourceFilesList, {
          loading: false,
          loadError: 'boom',
          textSizeClass: 'text-xs',
          entries: [],
          expandedPaths: new Set<string>(),
          activePath: null,
          toggleExpanded: () => void 0,
          onSelectFile: () => void 0,
          onSelectFolder: () => void 0,
          sourcesByPath: null,
          onRevealInFinder: () => void 0,
          onRenameEntry: () => void 0,
          onDeleteEntry: () => void 0,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (!(container.textContent || '').includes('Failed: boom')) {
      throw new Error('expected source files list to render error state')
    }

    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceSourceFilesList, {
          loading: false,
          loadError: '',
          textSizeClass: 'text-xs',
          entries: [
            {
              path: WORKSPACE_ROOT_PATH,
              parentPath: null,
              kind: 'folder',
              name: '',
              updatedAtMs: 0,
            },
            {
              path: 'note.md',
              parentPath: WORKSPACE_ROOT_PATH,
              kind: 'file',
              name: 'note.md',
              text: '# note',
              updatedAtMs: 1,
            },
          ],
          expandedPaths: new Set<string>(),
          activePath: null,
          toggleExpanded: () => void 0,
          onSelectFile: path => {
            clicks.push(path)
          },
          onSelectFolder: () => void 0,
          sourcesByPath: null,
          onRevealInFinder: () => void 0,
          onRenameEntry: () => void 0,
          onDeleteEntry: () => void 0,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const button = Array.from(container.querySelectorAll('button')).find(
      node => String((node as HTMLButtonElement).getAttribute('aria-label') || '') === 'File note.md',
    ) as HTMLButtonElement | undefined
    if (!button) throw new Error('expected source files list to render markdown file tree rows')
    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    if (clicks.join(',') !== 'note.md') {
      throw new Error(`expected file tree click to forward note.md, got ${clicks.join(',')}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
