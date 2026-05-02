import type React from 'react'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'

export type WorkspaceRefreshSnapshot = {
  entries: WorkspaceEntry[]
  sourcesByPath: WorkspaceSourceIndex
}

export type UseWorkspaceFileActionsArgs = {
  getFs: () => Promise<WorkspaceFs>
  refresh: () => Promise<WorkspaceRefreshSnapshot>

  openedPath: WorkspacePath | null
  selectionPath: WorkspacePath | null
  selectionEntryKind: WorkspaceEntry['kind'] | null
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  setActiveText: (next: string) => void
  setEntries: React.Dispatch<React.SetStateAction<WorkspaceEntry[]>>
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>

  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  setActivePathSafe: (path: WorkspacePath) => void
  setSelectionPathSafe: (path: WorkspacePath) => void

  setActiveMarkdownDocument: (args: {
    name: string
    text: string
    sourceUrl?: string | null
    jsonSourceText?: string | null
    autoEnableFrontmatter?: boolean
    applyViewPreset?: boolean
    recent?: Omit<import('@/hooks/store/types').RecentFileEntry, 'id' | 'timestamp'> | null
    applyToGraph?: boolean
    forceApplyToGraph?: boolean
    normalizeMermaidMmd?: boolean
  }) => Promise<boolean>
  applyMarkdownDocumentToGraph: (name: string, text: string, opts?: { force?: boolean }) => Promise<boolean>
}

export type WorkspaceImportActionsCtx = Pick<
  UseWorkspaceFileActionsArgs,
  'getFs' | 'refresh' | 'openedPath' | 'activeDocumentKey' | 'setActiveText' | 'setEntries' | 'lastLoadedRef' | 'setActiveMarkdownDocument'
>

export type WorkspaceWebsiteImportCtx = Pick<UseWorkspaceFileActionsArgs, 'getFs' | 'refresh'>

export type WorkspaceMutationActionsCtx = Pick<
  UseWorkspaceFileActionsArgs,
  | 'getFs'
  | 'refresh'
  | 'openedPath'
  | 'selectionPath'
  | 'selectionEntryKind'
  | 'activeDocumentKey'
  | 'setActiveText'
  | 'setEntries'
  | 'lastLoadedRef'
  | 'setActiveMarkdownDocument'
  | 'setActivePathSafe'
  | 'setSelectionPathSafe'
>

export type WorkspaceFileActions = {
  createNewFile: (opts?: { parentPath?: WorkspacePath }) => Promise<void>
  createNewFolder: (opts?: { parentPath?: WorkspacePath }) => Promise<void>
  handleImportLocalFiles: (files: FileList | null) => Promise<void>
  handleImportLocalFolder: (files: FileList | null) => Promise<void>
  handleImportUrl: (urlRaw: string) => Promise<void>
  handleImportWebsite: (urlRaw: string) => Promise<void>
  onDeleteEntry: (path: WorkspacePath) => void
  onRenameEntry: (path: WorkspacePath, nextName: string) => void
  onClearFile: (path: WorkspacePath) => void
  refreshFileFromSource: (path: WorkspacePath) => Promise<void>
  canClearActiveSelection: boolean
  canDeleteActive: boolean
  onClearActiveSelection: () => void
  onDeleteActive: () => void
}

export type StatusHelpers = {
  setStatusInfo: (label: string, opts?: { ttlMs?: number | null; dismissible?: boolean }) => void
  setStatusWarning: (label: string, opts?: { ttlMs?: number | null; dismissible?: boolean }) => void
  setStatusError: (label: string, opts?: { ttlMs?: number | null; dismissible?: boolean }) => void
  setStatusProgress: (
    label: string,
    current?: number | null,
    total?: number | null,
    bytesCurrent?: number | null,
    bytesTotal?: number | null,
    opts?: { ttlMs?: number | null },
  ) => void
  clearStatus: () => void
  buildWebpageImportStageLabel: (pctRaw: number) => string
}
