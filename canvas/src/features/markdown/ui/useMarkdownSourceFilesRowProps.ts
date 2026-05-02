import React from 'react'
import type { VisibleMarkdownSourceFileTreeNode } from './markdownSourceFileTree'
import type { MarkdownSourceFilesTreeRowProps } from './MarkdownSourceFilesTreeRow'

export function useMarkdownSourceFilesRowProps(args: {
  expandedSourceFolderPaths: ReadonlySet<string>
  selectedSourceFolderPath: string
  dragOverSourceFileId: string | null
  uiPanelTextFontClass: string
  iconClassName: string
  indentBasePx: number
  indentStepPx: number
  canWrite: boolean
  onSelectFolder: (path: string) => void
  onSelectFile: (args: { fileId: string; path: string }) => void
  onDeleteFile?: (path: string) => void | Promise<void>
  handleDragStart: (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => boolean
  handleDragOver: (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => boolean
  handleDrop: (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => boolean
  handleDragLeave: (event: React.DragEvent<HTMLElement>, fileId: string | null | undefined) => void
  clearDragState: React.DragEventHandler<HTMLButtonElement>
}) {
  const {
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    dragOverSourceFileId,
    uiPanelTextFontClass,
    iconClassName,
    indentBasePx,
    indentStepPx,
    canWrite,
    onSelectFolder,
    onSelectFile,
    onDeleteFile,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragLeave,
    clearDragState,
  } = args

  return React.useCallback(
    (node: VisibleMarkdownSourceFileTreeNode): MarkdownSourceFilesTreeRowProps => ({
      node,
      expanded: node.kind === 'folder' && expandedSourceFolderPaths.has(node.path),
      isSelectedFolder: node.kind === 'folder' && selectedSourceFolderPath === node.path,
      dragOverSourceFileId,
      uiPanelTextFontClass,
      iconClassName,
      indentBasePx,
      indentStepPx,
      canWrite,
      onSelectFolder,
      onSelectFile,
      onDeleteFile,
      onDragStart: event => {
        handleDragStart(event, node.fileId)
      },
      onDragOver: event => {
        handleDragOver(event, node.fileId)
      },
      onDrop: event => {
        handleDrop(event, node.fileId)
      },
      onDragEnd: clearDragState,
      onDragLeave: event => {
        handleDragLeave(event, node.fileId)
      },
    }),
    [
      canWrite,
      clearDragState,
      dragOverSourceFileId,
      expandedSourceFolderPaths,
      handleDragLeave,
      handleDragOver,
      handleDragStart,
      handleDrop,
      iconClassName,
      indentBasePx,
      indentStepPx,
      onDeleteFile,
      onSelectFile,
      onSelectFolder,
      selectedSourceFolderPath,
      uiPanelTextFontClass,
    ],
  )
}
