import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import type { VisibleMarkdownSourceFileTreeNode } from '@/features/markdown/ui/markdownSourceFileTree'
import { useMarkdownSourceFilesPanelView } from '@/features/markdown/ui/useMarkdownSourceFilesPanelView'

export async function testUseMarkdownSourceFilesPanelViewCentralizesSourcePanelViewComposition() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const reorderCalls: Array<{ fromId: string; toId: string }> = []
  const selectedFolders: string[] = []
  const selectedFiles: Array<{ fileId: string; path: string }> = []

  const folderNode: VisibleMarkdownSourceFileTreeNode = {
    kind: 'folder',
    key: 'folder:docs',
    label: 'docs',
    path: 'docs',
    depth: 1,
    hasChildren: true,
  }
  const fileNode: VisibleMarkdownSourceFileTreeNode = {
    kind: 'file',
    key: 'file:intro',
    label: 'intro.md',
    path: 'docs/intro.md',
    depth: 2,
    fileId: 'intro',
    active: true,
  }
  const targetFileNode: VisibleMarkdownSourceFileTreeNode = {
    kind: 'file',
    key: 'file:readme',
    label: 'readme.md',
    path: 'docs/readme.md',
    depth: 2,
    fileId: 'readme',
    active: false,
  }

  function Harness() {
    const { buildRowProps } = useMarkdownSourceFilesPanelView({
      expandedSourceFolderPaths: new Set(['docs']),
      selectedSourceFolderPath: 'docs',
      uiPanelTextFontClass: 'font-sans',
      iconClassName: 'w-3 h-3',
      canWrite: true,
      onSelectFolder: path => {
        selectedFolders.push(path)
      },
      onSelectFile: args => {
        selectedFiles.push(args)
      },
      onReorderSourceFiles: (fromId, toId) => {
        reorderCalls.push({ fromId, toId })
      },
    })
    const folderProps = buildRowProps(folderNode)
    const fileProps = buildRowProps(fileNode)
    const targetFileProps = buildRowProps(targetFileNode)

    return (
      <section>
        <button type="button" aria-label="folder-select" onClick={() => folderProps.onSelectFolder(folderProps.node.path)} />
        <button
          type="button"
          aria-label="file-select"
          onClick={() => fileProps.onSelectFile({ fileId: String(fileProps.node.fileId || ''), path: fileProps.node.path })}
        />
        <button
          type="button"
          aria-label="drag-start"
          onClick={() => {
            const event = {
              target: dom.window.document.createElement('section'),
              dataTransfer: {
                effectAllowed: '',
                setData: () => void 0,
              },
              preventDefault: () => void 0,
            } as unknown as React.DragEvent<HTMLElement>
            fileProps.onDragStart(event as React.DragEvent<HTMLButtonElement>)
          }}
        />
        <button
          type="button"
          aria-label="drag-over"
          onClick={() => {
            const event = {
              dataTransfer: { dropEffect: '' },
              preventDefault: () => void 0,
            } as unknown as React.DragEvent<HTMLElement>
            targetFileProps.onDragOver(event as React.DragEvent<HTMLButtonElement>)
          }}
        />
        <button
          type="button"
          aria-label="drop"
          onClick={() => {
            const event = {
              dataTransfer: { getData: () => 'intro' },
              preventDefault: () => void 0,
            } as unknown as React.DragEvent<HTMLElement>
            targetFileProps.onDrop(event as React.DragEvent<HTMLButtonElement>)
          }}
        />
        <span data-testid="folder-expanded">{folderProps.expanded ? 'true' : 'false'}</span>
        <span data-testid="folder-selected">{folderProps.isSelectedFolder ? 'true' : 'false'}</span>
        <span data-testid="file-drag-over">{fileProps.dragOverSourceFileId || ''}</span>
      </section>
    )
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const folderExpanded = container.querySelector('[data-testid="folder-expanded"]')?.textContent || ''
    const folderSelected = container.querySelector('[data-testid="folder-selected"]')?.textContent || ''
    const fileDragOver = container.querySelector('[data-testid="file-drag-over"]')?.textContent || ''
    if (folderExpanded !== 'true') throw new Error(`expected folder expanded true, got ${folderExpanded}`)
    if (folderSelected !== 'true') throw new Error(`expected folder selected true, got ${folderSelected}`)
    if (fileDragOver !== '') throw new Error(`expected initial drag-over state empty, got ${fileDragOver}`)

    for (const label of ['folder-select', 'file-select', 'drag-start', 'drag-over', 'drop']) {
      const button = container.querySelector(`button[aria-label="${label}"]`)
      if (!(button instanceof dom.window.HTMLButtonElement)) throw new Error(`expected ${label} button`)
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        await new Promise(resolve => setTimeout(resolve, 0))
      })
    }

    if (selectedFolders[0] !== 'docs') throw new Error(`expected docs folder selection, got ${JSON.stringify(selectedFolders)}`)
    if (selectedFiles[0]?.fileId !== 'intro') throw new Error(`expected intro file selection, got ${JSON.stringify(selectedFiles)}`)
    if (reorderCalls[0]?.fromId !== 'intro' || reorderCalls[0]?.toId !== 'readme') {
      throw new Error(`expected reorder intro -> readme, got ${JSON.stringify(reorderCalls)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
