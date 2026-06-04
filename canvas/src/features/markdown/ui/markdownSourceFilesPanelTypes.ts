export type MarkdownSourceFileListItem = {
  id: string
  name: string
  active?: boolean
  versionCount?: number
}

export type MarkdownSourceFilesPanelIntegration = {
  iconClassName: string
  folderName: string | null
  canWrite: boolean
  accessMode: string | null
  selectedFolderPath?: string | null
  onOpenFolder: () => void | Promise<void>
  onRefreshFiles?: () => void | Promise<void>
  onCreateFolder?: (parentPath: string | null) => Promise<string | null> | string | null
  onCreateFile?: (parentPath: string | null) => void
  onDeleteFile?: (path: string) => void | Promise<void>
  onReorderSourceFiles?: (fromId: string, toId: string) => void
  onAfterReorderSourceFiles?: () => void
  onSelectedFolderPathChange?: (path: string) => void
}

export type MarkdownSourceFilesPanelProps = {
  uiPanelTextFontClass: string
  sourceFiles?: MarkdownSourceFileListItem[]
  onSourceFileSelect?: (id: string) => void
  integration: MarkdownSourceFilesPanelIntegration
}
