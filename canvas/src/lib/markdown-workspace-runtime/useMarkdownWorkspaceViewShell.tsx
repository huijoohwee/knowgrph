import React from 'react'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { WorkspaceModeSelect } from '@/components/BottomPanel/markdownWorkspace/WorkspaceModeSelect'
import {
  cancelMarkdownWorkspaceInlineEditStateSync,
  scheduleMarkdownWorkspaceInlineEditStateSync,
} from './markdownWorkspaceRuntime.stateSync'
import type { FolderModeContract } from './markdownWorkspaceRuntime.shared'

export function useMarkdownWorkspaceViewShell(args: {
  entries: WorkspaceEntry[]
  sourcesByPath: WorkspaceSourceIndex
  folderModeContract: FolderModeContract
  setFolderModeContract: React.Dispatch<React.SetStateAction<FolderModeContract>>
  selectionPath: WorkspacePath | null
  selectionEntryKind: WorkspaceEntry['kind'] | null
  setActivePathSafe: (path: WorkspacePath) => void
  setSelectionPathSafe: (path: WorkspacePath) => void
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  resolveFolderContractDocPath: (folderPath: WorkspacePath, mode: FolderModeContract) => WorkspacePath
  pickFolderContractTargetPath: (folderPath: WorkspacePath, preferredMode: FolderModeContract) => WorkspacePath | null
  youtubeWorkspaceMeta: { format: 'markdown' | 'json' } | null
  switchActiveYoutubeWorkspaceFormat: (format: 'markdown' | 'json') => Promise<void>
  revealLineInEditor: (line: number) => void
  setStatusWithAutoClear: (label: string, ttlMs?: number) => void
}) {
  const toggleExpanded = React.useCallback((path: WorkspacePath) => {
    const normalized = normalizeWorkspacePath(path)
    args.setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(normalized)) next.delete(normalized)
      else next.add(normalized)
      return next
    })
  }, [args.setExpandedPaths])

  const onSelectFile = React.useCallback(
    (path: WorkspacePath) => {
      args.setActivePathSafe(path)
      args.setSelectionPathSafe(path)
    },
    [args.setActivePathSafe, args.setSelectionPathSafe],
  )

  const onSelectFolder = React.useCallback(
    (path: WorkspacePath) => {
      args.setSelectionPathSafe(path)
      const target = args.pickFolderContractTargetPath(path, args.folderModeContract)
      if (target) args.setActivePathSafe(target)
    },
    [args.folderModeContract, args.pickFolderContractTargetPath, args.setActivePathSafe, args.setSelectionPathSafe],
  )

  const renderSourceFileRight = React.useCallback(
    (renderArgs: { entry: WorkspaceEntry; isActive: boolean }) => {
      if (!renderArgs.isActive) return null
      if (renderArgs.entry.kind === 'folder') {
        const sitemapPath = args.resolveFolderContractDocPath(renderArgs.entry.path, 'sitemap')
        const journeyPath = args.resolveFolderContractDocPath(renderArgs.entry.path, 'user-journey')
        const hasSitemap = args.entries.some(entry => entry.kind === 'file' && entry.path === sitemapPath)
        const hasJourney = args.entries.some(entry => entry.kind === 'file' && entry.path === journeyPath)
        if (!hasSitemap && !hasJourney) return null
        return (
          <WorkspaceModeSelect<FolderModeContract>
            ariaLabel="Folder mode contract"
            value={args.folderModeContract}
            isActive={renderArgs.isActive}
            options={[
              { value: 'sitemap', label: 'Sitemap' },
              { value: 'user-journey', label: 'User Journey' },
            ]}
            onChange={next => {
              args.setFolderModeContract(next)
              const target = args.pickFolderContractTargetPath(renderArgs.entry.path, next)
              if (target) args.setActivePathSafe(target)
            }}
          />
        )
      }
      if (args.youtubeWorkspaceMeta) {
        return (
          <WorkspaceModeSelect<'markdown' | 'json'>
            ariaLabel="YouTube transcript format"
            value={args.youtubeWorkspaceMeta.format}
            isActive={renderArgs.isActive}
            options={[
              { value: 'markdown', label: 'Markdown' },
              { value: 'json', label: 'JSON' },
            ]}
            onChange={next => void args.switchActiveYoutubeWorkspaceFormat(next)}
          />
        )
      }
      return null
    },
    [
      args.entries,
      args.folderModeContract,
      args.pickFolderContractTargetPath,
      args.resolveFolderContractDocPath,
      args.setActivePathSafe,
      args.setFolderModeContract,
      args.switchActiveYoutubeWorkspaceFormat,
      args.youtubeWorkspaceMeta,
    ],
  )

  const revealInFinder = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      const source = args.sourcesByPath[normalized]
      if (source && source.kind === 'url' && String(source.url || '').trim()) {
        try {
          window.open(String(source.url || '').trim(), '_blank', 'noopener,noreferrer')
          args.setStatusWithAutoClear('Opened source URL', UI_TOAST_TTL_MS.statusAutoClose)
          return
        } catch {
          void 0
        }
      }
      const localName = source && source.kind === 'local' ? String(source.originalName || '').trim() : ''
      const localLooksAbsolute = !!localName && (localName.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(localName))
      if (localLooksAbsolute) {
        try {
          window.open(`file://${localName.replace(/\\/g, '/')}`, '_blank', 'noopener,noreferrer')
          args.setStatusWithAutoClear('Opened local file URL', UI_TOAST_TTL_MS.statusAutoCloseMedium)
          return
        } catch {
          void 0
        }
      }
      if (source && source.kind === 'local') {
        try {
          void navigator.clipboard?.writeText(normalized.replace(/^\/+/, '') || normalized)
          args.setStatusWithAutoClear('Copied workspace-relative path', UI_TOAST_TTL_MS.statusAutoCloseSlow)
        } catch {
          void 0
        }
      }
      args.setSelectionPathSafe(normalized)
      args.setActivePathSafe(normalized)
      args.setStatusWithAutoClear('Revealed in Source Files explorer', UI_TOAST_TTL_MS.statusAutoCloseSlow)
    },
    [args.setActivePathSafe, args.setSelectionPathSafe, args.setStatusWithAutoClear, args.sourcesByPath],
  )

  const openBacklink = React.useCallback(
    (backlink: { path: WorkspacePath; line: number }) => {
      args.setActivePathSafe(backlink.path)
      args.setSelectionPathSafe(backlink.path)
      args.revealLineInEditor(backlink.line)
    },
    [args.revealLineInEditor, args.setActivePathSafe, args.setSelectionPathSafe],
  )

  const lastViewerInlineEditSignalRef = React.useRef<boolean | null>(null)
  const handleViewerInlineEditStateChange = React.useCallback((active: boolean, setViewerInlineEditActive: (fn: (prev: boolean) => boolean) => void) => {
    if (lastViewerInlineEditSignalRef.current === active) return
    lastViewerInlineEditSignalRef.current = active
    scheduleMarkdownWorkspaceInlineEditStateSync(active, () => {
      setViewerInlineEditActive(prev => (prev === active ? prev : active))
    })
  }, [])

  React.useEffect(() => {
    return () => {
      cancelMarkdownWorkspaceInlineEditStateSync()
    }
  }, [])

  const canRefreshActiveFromSource = React.useMemo(() => {
    if (!args.selectionPath || args.selectionEntryKind !== 'file') return false
    const source = args.sourcesByPath[args.selectionPath]
    return !!(source && source.kind === 'url' && String(source.url || '').trim())
  }, [args.selectionEntryKind, args.selectionPath, args.sourcesByPath])

  return {
    toggleExpanded,
    onSelectFile,
    onSelectFolder,
    renderSourceFileRight,
    revealInFinder,
    openBacklink,
    handleViewerInlineEditStateChange,
    canRefreshActiveFromSource,
  }
}
