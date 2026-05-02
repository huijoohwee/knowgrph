import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownSourceFilesTreeRow } from '@/features/markdown/ui/MarkdownSourceFilesTreeRow'

export async function testMarkdownSourceFilesTreeRowCentralizesSourcePanelRowUi() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const selectedFolders: string[] = []
  const selectedFiles: Array<{ fileId: string; path: string }> = []
  const deletedPaths: string[] = []
  const previousConfirm = globalThis.window?.confirm
  dom.window.confirm = () => true

  try {
    await act(async () => {
      root.render(
        React.createElement(
          'ul',
          null,
          React.createElement(MarkdownSourceFilesTreeRow, {
            node: {
              kind: 'folder',
              key: 'folder:docs',
              label: 'docs',
              path: 'docs',
              depth: 1,
              hasChildren: true,
            },
            expanded: false,
            isSelectedFolder: false,
            dragOverSourceFileId: null,
            uiPanelTextFontClass: 'font-sans',
            iconClassName: 'w-3 h-3',
            indentBasePx: 6,
            indentStepPx: 12,
            canWrite: true,
            onSelectFolder: path => {
              selectedFolders.push(path)
            },
            onSelectFile: args => {
              selectedFiles.push(args)
            },
            onDeleteFile: path => {
              deletedPaths.push(path)
            },
            onDragStart: () => void 0,
            onDragOver: () => void 0,
            onDrop: () => void 0,
            onDragEnd: () => void 0,
            onDragLeave: () => void 0,
          }),
          React.createElement(MarkdownSourceFilesTreeRow, {
            node: {
              kind: 'file',
              key: 'file:intro',
              label: 'intro.md',
              path: 'docs/intro.md',
              depth: 2,
              fileId: 'intro',
              active: true,
            },
            expanded: false,
            isSelectedFolder: false,
            dragOverSourceFileId: 'intro',
            uiPanelTextFontClass: 'font-sans',
            iconClassName: 'w-3 h-3',
            indentBasePx: 6,
            indentStepPx: 12,
            canWrite: true,
            onSelectFolder: path => {
              selectedFolders.push(path)
            },
            onSelectFile: args => {
              selectedFiles.push(args)
            },
            onDeleteFile: path => {
              deletedPaths.push(path)
            },
            onDragStart: () => void 0,
            onDragOver: () => void 0,
            onDrop: () => void 0,
            onDragEnd: () => void 0,
            onDragLeave: () => void 0,
          }),
        ),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const docsButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('docs')) || null
    if (!(docsButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected source row folder button')
    await act(async () => {
      docsButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (selectedFolders[0] !== 'docs') throw new Error(`expected folder row selection callback for docs, got ${JSON.stringify(selectedFolders)}`)

    const introButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('intro.md')) || null
    if (!(introButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected source row file button')
    await act(async () => {
      introButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (selectedFiles[0]?.fileId !== 'intro') throw new Error(`expected file row selection callback for intro, got ${JSON.stringify(selectedFiles)}`)

    const deleteButton = Array.from(container.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === 'Delete file') || null
    if (!(deleteButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected shared source row delete button')
    await act(async () => {
      deleteButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (deletedPaths[0] !== 'docs/intro.md') throw new Error(`expected delete action for intro path, got ${JSON.stringify(deletedPaths)}`)
  } finally {
    if (previousConfirm) {
      dom.window.confirm = previousConfirm
    }
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
