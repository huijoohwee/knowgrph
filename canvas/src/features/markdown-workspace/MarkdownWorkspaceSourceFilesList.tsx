import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MarkdownFileTree } from './MarkdownFileTree'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { buildPublishedDocShareUrlFromSource } from '@/features/canvas/canvasDocDeepLink'

type MarkdownWorkspaceSourceFilesListProps = {
  loading: boolean
  loadError: string
  textSizeClass: string
  entries: WorkspaceEntry[]
  expandedPaths: Set<string>
  activePath: WorkspacePath | null
  toggleExpanded: (path: WorkspacePath) => void
  onSelectFile: (path: WorkspacePath) => void
  onSelectFolder: (path: WorkspacePath) => void
  sourcesByPath: WorkspaceSourceIndex | null
  onCreateNewFile: (parentPath?: WorkspacePath) => void
  onRevealInFinder: (path: WorkspacePath) => void
  onClearFile: (path: WorkspacePath) => void
  onRenameEntry: (path: WorkspacePath, nextName: string) => void
  onDeleteEntry: (path: WorkspacePath) => void
  renderFileRight?: (args: { entry: WorkspaceEntry; isActive: boolean }) => React.ReactNode
}

export function MarkdownWorkspaceSourceFilesList(props: MarkdownWorkspaceSourceFilesListProps) {
  const {
    loading,
    loadError,
    textSizeClass,
    entries,
    expandedPaths,
    activePath,
    toggleExpanded,
    onSelectFile,
    onSelectFolder,
    sourcesByPath,
    onCreateNewFile,
    onRevealInFinder,
    onClearFile,
    onRenameEntry,
    onDeleteEntry,
    renderFileRight,
  } = props

  const buildShareUrl = React.useCallback((entryPath: WorkspacePath): string | null => {
    const source = sourcesByPath?.[entryPath]
    if (!source || source.kind !== 'url') return null
    return buildPublishedDocShareUrlFromSource({ sourceUrl: source.url })
  }, [sourcesByPath])

  if (loading) {
    return <p className={`px-2 py-1 ${textSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>Loading…</p>
  }

  if (loadError) {
    return <p className={`px-2 py-1 ${textSizeClass} ${UI_THEME_TOKENS.status.error}`}>Failed: {loadError}</p>
  }

  return (
    <MarkdownFileTree
      entries={entries}
      expandedPaths={expandedPaths}
      toggleExpanded={toggleExpanded}
      activePath={activePath}
      onSelectFile={onSelectFile}
      onSelectFolder={onSelectFolder}
      sourcesByPath={sourcesByPath}
      onCreateNewFile={onCreateNewFile}
      onRevealInFinder={onRevealInFinder}
      onClearFile={onClearFile}
      onRenameEntry={onRenameEntry}
      onDeleteEntry={onDeleteEntry}
      buildShareUrl={buildShareUrl}
      renderFileRight={renderFileRight}
    />
  )
}
