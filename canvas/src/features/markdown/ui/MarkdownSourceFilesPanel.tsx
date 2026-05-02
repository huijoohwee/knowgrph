import React from 'react'
import { useMarkdownSourceFilesPanelModel } from './useMarkdownSourceFilesPanelModel'
import { useMarkdownSourceFilesPanelView } from './useMarkdownSourceFilesPanelView'
import { MarkdownSourceFilesPanelEmptyState } from './MarkdownSourceFilesPanelEmptyState'
import { MarkdownSourceFilesTree } from './MarkdownSourceFilesTree'
import type { MarkdownSourceFilesPanelProps } from './markdownSourceFilesPanelTypes'

export function MarkdownSourceFilesPanel(props: MarkdownSourceFilesPanelProps) {
  const {
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    selectFolder,
    selectFile,
    visible,
  } = useMarkdownSourceFilesPanelModel({
    sourceFiles: props.sourceFiles,
    selectedFolderPath: props.integration.selectedFolderPath,
    onSelectedFolderPathChange: props.integration.onSelectedFolderPathChange,
    onSourceFileSelect: props.onSourceFileSelect,
  })
  const { uiPanelTextFontClass, integration } = props

  const { buildRowProps } = useMarkdownSourceFilesPanelView({
    expandedSourceFolderPaths,
    selectedSourceFolderPath,
    uiPanelTextFontClass,
    iconClassName: integration.iconClassName,
    canWrite: integration.canWrite,
    onSelectFolder: selectFolder,
    onSelectFile: selectFile,
    onDeleteFile: integration.onDeleteFile,
    onReorderSourceFiles: integration.onReorderSourceFiles,
    onAfterReorderSourceFiles: integration.onAfterReorderSourceFiles,
  })
  const hasAny = visible.length > 0
  return (
    hasAny ? (
      <MarkdownSourceFilesTree visible={visible} buildRowProps={buildRowProps} />
    ) : (
      <MarkdownSourceFilesPanelEmptyState
        uiPanelTextFontClass={uiPanelTextFontClass}
        folderName={integration.folderName}
      />
    )
  )
}
