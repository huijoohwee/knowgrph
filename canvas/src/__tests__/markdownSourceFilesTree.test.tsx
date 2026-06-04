import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownSourceFilesTree } from '@/features/markdown/ui/MarkdownSourceFilesTree'
import type { MarkdownSourceFilesTreeRowProps } from '@/features/markdown/ui/MarkdownSourceFilesTreeRow'
import type { VisibleMarkdownSourceFileTreeNode } from '@/features/markdown/ui/markdownSourceFileTree'

export async function testMarkdownSourceFilesTreeCentralizesSourcePanelTreeShell() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const selectedFolders: string[] = []
  const selectedFiles: Array<{ fileId: string; path: string }> = []

  const visible: VisibleMarkdownSourceFileTreeNode[] = [
    {
      kind: 'folder',
      key: 'folder:docs',
      label: 'docs',
      path: 'docs',
      depth: 1,
      hasChildren: true,
    },
    {
      kind: 'file',
      key: 'file:intro',
      label: 'intro.md',
      path: 'docs/intro.md',
      depth: 2,
      fileId: 'intro',
      active: true,
    },
  ]

  const buildRowProps = (node: VisibleMarkdownSourceFileTreeNode): MarkdownSourceFilesTreeRowProps => ({
    node,
    expanded: node.kind === 'folder',
    isSelectedFolder: node.kind === 'folder',
    dragOverSourceFileId: 'intro',
    uiPanelTextFontClass: 'font-sans',
    iconClassName: 'w-3 h-3',
    indentBasePx: 6,
    indentStepPx: 12,
    canWrite: false,
    onSelectFolder: path => {
      selectedFolders.push(path)
    },
    onSelectFile: args => {
      selectedFiles.push(args)
    },
    onDeleteFile: undefined,
    onDragStart: () => void 0,
    onDragOver: () => void 0,
    onDrop: () => void 0,
    onDragEnd: () => void 0,
    onDragLeave: () => void 0,
  })

  try {
    await act(async () => {
      root.render(React.createElement(MarkdownSourceFilesTree, { visible, buildRowProps }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const tree = container.querySelector('ul[role="tree"]')
    if (!(tree instanceof dom.window.HTMLUListElement)) throw new Error('expected source files tree list')

    const docsButton = (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.includes('docs'),
    ) || null
    if (!(docsButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected docs folder button')
    await act(async () => {
      docsButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (selectedFolders[0] !== 'docs') throw new Error(`expected docs folder selection, got ${JSON.stringify(selectedFolders)}`)

    const introButton = (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.includes('intro.md'),
    ) || null
    if (!(introButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected intro file button')
    await act(async () => {
      introButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (selectedFiles[0]?.fileId !== 'intro') throw new Error(`expected intro file selection, got ${JSON.stringify(selectedFiles)}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
