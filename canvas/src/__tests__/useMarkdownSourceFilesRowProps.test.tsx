import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useMarkdownSourceFilesRowProps } from '@/features/markdown/ui/useMarkdownSourceFilesRowProps'
import type { VisibleMarkdownSourceFileTreeNode } from '@/features/markdown/ui/markdownSourceFileTree'

export async function testUseMarkdownSourceFilesRowPropsCentralizesSourcePanelRowAdapters() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const folderSelections: string[] = []
  const fileSelections: Array<{ fileId: string; path: string }> = []
  const deletedPaths: string[] = []
  const dragStarts: string[] = []
  const dragOvers: string[] = []
  const drops: string[] = []
  const dragLeaves: string[] = []
  let dragEnds = 0

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

  function Harness() {
    const buildRowProps = useMarkdownSourceFilesRowProps({
      expandedSourceFolderPaths: new Set(['docs']),
      selectedSourceFolderPath: 'docs',
      dragOverSourceFileId: 'intro',
      uiPanelTextFontClass: 'font-sans',
      iconClassName: 'w-3 h-3',
      indentBasePx: 6,
      indentStepPx: 12,
      canWrite: true,
      onSelectFolder: path => {
        folderSelections.push(path)
      },
      onSelectFile: args => {
        fileSelections.push(args)
      },
      onDeleteFile: path => {
        deletedPaths.push(path)
      },
      handleDragStart: (_event, fileId) => {
        dragStarts.push(String(fileId || ''))
        return true
      },
      handleDragOver: (_event, fileId) => {
        dragOvers.push(String(fileId || ''))
        return true
      },
      handleDrop: (_event, fileId) => {
        drops.push(String(fileId || ''))
        return true
      },
      handleDragLeave: (_event, fileId) => {
        dragLeaves.push(String(fileId || ''))
      },
      clearDragState: () => {
        dragEnds += 1
      },
    })
    const folderProps = buildRowProps(folderNode)
    const fileProps = buildRowProps(fileNode)

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
          aria-label="file-delete"
          onClick={() => {
            if (fileProps.onDeleteFile) void fileProps.onDeleteFile(fileProps.node.path)
          }}
        />
        <button
          type="button"
          aria-label="file-drag-start"
          onClick={() => fileProps.onDragStart({} as React.DragEvent<HTMLButtonElement>)}
        />
        <button
          type="button"
          aria-label="file-drag-over"
          onClick={() => fileProps.onDragOver({} as React.DragEvent<HTMLButtonElement>)}
        />
        <button
          type="button"
          aria-label="file-drop"
          onClick={() => fileProps.onDrop({} as React.DragEvent<HTMLButtonElement>)}
        />
        <button
          type="button"
          aria-label="file-drag-leave"
          onClick={() => fileProps.onDragLeave({} as React.DragEvent<HTMLButtonElement>)}
        />
        <button
          type="button"
          aria-label="file-drag-end"
          onClick={() => fileProps.onDragEnd({} as React.DragEvent<HTMLButtonElement>)}
        />
        <span data-testid="folder-expanded">{folderProps.expanded ? 'true' : 'false'}</span>
        <span data-testid="folder-selected">{folderProps.isSelectedFolder ? 'true' : 'false'}</span>
        <span data-testid="file-drag-over">{fileProps.dragOverSourceFileId || ''}</span>
        <span data-testid="file-can-write">{fileProps.canWrite ? 'true' : 'false'}</span>
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
    const fileCanWrite = container.querySelector('[data-testid="file-can-write"]')?.textContent || ''
    if (folderExpanded !== 'true') throw new Error(`expected folder row props to mark docs expanded, got ${folderExpanded}`)
    if (folderSelected !== 'true') throw new Error(`expected folder row props to mark docs selected, got ${folderSelected}`)
    if (fileDragOver !== 'intro') throw new Error(`expected file row props drag target intro, got ${fileDragOver}`)
    if (fileCanWrite !== 'true') throw new Error(`expected file row props canWrite true, got ${fileCanWrite}`)

    for (const label of [
      'folder-select',
      'file-select',
      'file-delete',
      'file-drag-start',
      'file-drag-over',
      'file-drop',
      'file-drag-leave',
      'file-drag-end',
    ]) {
      const button = container.querySelector(`button[aria-label="${label}"]`)
      if (!(button instanceof dom.window.HTMLButtonElement)) throw new Error(`expected ${label} button`)
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        await new Promise(resolve => setTimeout(resolve, 0))
      })
    }

    if (folderSelections[0] !== 'docs') throw new Error(`expected folder selection docs, got ${JSON.stringify(folderSelections)}`)
    if (fileSelections[0]?.fileId !== 'intro') throw new Error(`expected file selection intro, got ${JSON.stringify(fileSelections)}`)
    if (deletedPaths[0] !== 'docs/intro.md') throw new Error(`expected delete path docs/intro.md, got ${JSON.stringify(deletedPaths)}`)
    if (dragStarts[0] !== 'intro') throw new Error(`expected drag start intro, got ${JSON.stringify(dragStarts)}`)
    if (dragOvers[0] !== 'intro') throw new Error(`expected drag over intro, got ${JSON.stringify(dragOvers)}`)
    if (drops[0] !== 'intro') throw new Error(`expected drop intro, got ${JSON.stringify(drops)}`)
    if (dragLeaves[0] !== 'intro') throw new Error(`expected drag leave intro, got ${JSON.stringify(dragLeaves)}`)
    if (dragEnds !== 1) throw new Error(`expected one drag end callback, got ${String(dragEnds)}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
