import { useMarkdownSourceFileDnD } from './useMarkdownSourceFileDnD'
import { useMarkdownSourceFilesRowProps } from './useMarkdownSourceFilesRowProps'

export function useMarkdownSourceFilesPanelView(args: {
  expandedSourceFolderPaths: ReadonlySet<string>
  selectedSourceFolderPath: string
  uiPanelTextFontClass: string
  iconClassName: string
  canWrite: boolean
  onSelectFolder: (path: string) => void
  onSelectFile: (args: { fileId: string; path: string }) => void
  onDeleteFile?: (path: string) => void | Promise<void>
  onReorderSourceFiles?: (fromId: string, toId: string) => void
  onAfterReorderSourceFiles?: () => void
}) {
  const {
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    uiPanelTextFontClass,
    iconClassName,
    canWrite,
    onSelectFolder,
    onSelectFile,
    onDeleteFile,
    onReorderSourceFiles,
    onAfterReorderSourceFiles,
  } = args
  const {
    dragOverSourceFileId,
    handleDragLeave,
    handleDragOver,
    handleDragStart,
    handleDrop,
    clearDragState,
  } = useMarkdownSourceFileDnD({
    onReorderSourceFiles,
    onAfterReorderSourceFiles,
  })

  const treeIndentBasePx = 6
  const treeIndentStepPx = 12
  const buildRowProps = useMarkdownSourceFilesRowProps({
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    dragOverSourceFileId,
    uiPanelTextFontClass,
    iconClassName,
    indentBasePx: treeIndentBasePx,
    indentStepPx: treeIndentStepPx,
    canWrite,
    onSelectFolder,
    onSelectFile,
    onDeleteFile,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragLeave,
    clearDragState,
  })

  return {
    buildRowProps,
  }
}
