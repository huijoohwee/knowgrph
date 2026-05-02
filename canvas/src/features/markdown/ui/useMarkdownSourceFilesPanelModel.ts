import React from 'react'
import {
  buildMarkdownSourceFileTree,
  flattenVisibleMarkdownSourceFileTree,
  type MarkdownSourceFileListItemLike,
} from './markdownSourceFileTree'
import {
  persistMarkdownSourceFolderPaths,
  readPersistedMarkdownSourceFolderPaths,
} from './markdownSourceFilesPersistence'
import { useMarkdownSourceFilesSelection } from './useMarkdownSourceFilesSelection'

export function useMarkdownSourceFilesPanelModel(args: {
  sourceFiles?: ReadonlyArray<MarkdownSourceFileListItemLike>
  selectedFolderPath?: string | null
  onSelectedFolderPathChange?: (path: string) => void
  onSourceFileSelect?: (id: string) => void
}) {
  const {
    sourceFiles,
    selectedFolderPath,
    onSelectedFolderPathChange,
    onSourceFileSelect,
  } = args
  const initialExpandedSourceFolderPaths = React.useMemo(
    () => readPersistedMarkdownSourceFolderPaths(),
    [],
  )
  const {
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    selectFolder,
    selectFile,
  } = useMarkdownSourceFilesSelection({
    initialExpandedPaths: initialExpandedSourceFolderPaths,
    selectedFolderPath,
    onSelectedFolderPathChange,
    onSourceFileSelect,
  })

  React.useEffect(() => {
    persistMarkdownSourceFolderPaths(expandedSourceFolderPaths)
  }, [expandedSourceFolderPaths])

  const tree = React.useMemo(() => buildMarkdownSourceFileTree(sourceFiles), [sourceFiles])
  const visible = React.useMemo(
    () =>
      flattenVisibleMarkdownSourceFileTree({
        root: tree.root,
        expandedPaths: expandedSourceFolderPaths,
      }),
    [expandedSourceFolderPaths, tree.root],
  )

  return {
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    selectFolder,
    selectFile,
    visible,
  }
}
