import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownEditorSsotSync } from '@/components/BottomPanel/markdownWorkspace/useMarkdownEditorSsotSync'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  resolveWorkspaceStartupActivePath,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
} from '@/features/workspace-fs/workspaceFs'
import {
  normalizeWorkspacePath,
  workspaceDocumentKey,
  WORKSPACE_ROOT_PATH,
} from '@/features/workspace-fs/path'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { normalizeWebpageFrontmatterView } from '@/lib/markdown/frontmatter'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
import { toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'

type SetActiveMarkdownDocumentFn = (args: {
  name: string
  text: string
  normalizeMermaidMmd: boolean
  autoEnableFrontmatter?: boolean
  sourceUrl?: string | null
}) => unknown

export function useMarkdownWorkspaceSelection(args: {
  activePath: WorkspacePath | null
  setActivePath: (path: WorkspacePath) => void
  entries: WorkspaceEntry[]
  loading: boolean
  activeText: string
  setActiveText: (text: string) => void
  setActiveTextProgrammatic: (text: string) => void
  markdownDocumentName: string
  markdownDocumentText: string
  setActiveMarkdownDocument: SetActiveMarkdownDocumentFn
  sourcesByPath: WorkspaceSourceIndex
  viewerInlineEditActive: boolean
  activeRef: React.MutableRefObject<boolean>
  activeTextRef: React.MutableRefObject<string>
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  userEditedActiveTextRef: React.MutableRefObject<boolean>
  collapsedSnapshotRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  prevCollapsedRef: React.MutableRefObject<boolean>
  effectiveBottomPanelCollapsed: boolean
  canvas2dRenderer: string
  lastSetActivePath: { path: WorkspacePath; atMs: number } | null
  lastRequestedActivePathRef: React.MutableRefObject<{ path: WorkspacePath; atMs: number } | null>
  patchWorkspaceEntryInlineText: (path: WorkspacePath, text: string) => void
  clearStatus: () => void
  setHighlightedLineRange: (value: null) => void
}) {
  const setActivePathSafe = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = toCanonicalKgcWorkspacePath(normalizeWorkspacePath(path))
      args.lastRequestedActivePathRef.current = { path: normalized, atMs: Date.now() }
      args.setActivePath(normalized)
    },
    [args.lastRequestedActivePathRef, args.setActivePath],
  )

  const [selectionPath, setSelectionPath] = React.useState<WorkspacePath | null>(null)
  const selectionPathRef = React.useRef<WorkspacePath | null>(null)
  selectionPathRef.current = selectionPath

  const setSelectionPathSafe = React.useCallback((path: WorkspacePath) => {
    setSelectionPath(toCanonicalKgcWorkspacePath(normalizeWorkspacePath(path)))
  }, [])

  React.useEffect(() => {
    if (!selectionPathRef.current && args.activePath) {
      setSelectionPath(args.activePath)
    }
  }, [args.activePath])

  React.useEffect(() => {
    if (!selectionPath) return
    if (args.loading) return
    if (args.entries.some(entry => entry.path === selectionPath)) return
    if (args.activePath && args.entries.some(entry => entry.path === args.activePath)) {
      setSelectionPath(args.activePath)
      return
    }
    setSelectionPath(null)
  }, [args.activePath, args.entries, args.loading, selectionPath])

  const activeEntry = React.useMemo(() => {
    if (!args.activePath) return null
    return args.entries.find(entry => entry.path === args.activePath) || null
  }, [args.activePath, args.entries])

  const selectionEntry = React.useMemo(() => {
    if (!selectionPath) return null
    return args.entries.find(entry => entry.path === selectionPath) || null
  }, [args.entries, selectionPath])

  const activeEntryKind = activeEntry ? activeEntry.kind : null
  const activeEntryText = activeEntry && activeEntry.kind === 'file' ? activeEntry.text : undefined
  const activeDocumentKey = React.useMemo(() => {
    if (!args.activePath) return ''
    if (activeEntry && activeEntry.kind !== 'file') return ''
    return workspaceDocumentKey(args.activePath)
  }, [activeEntry, args.activePath])

  const activeDocumentSourceUrl = React.useMemo(() => {
    const path = args.activePath
    if (!path) return null
    const source = args.sourcesByPath[path]
    const url = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    return url ? url : null
  }, [args.activePath, args.sourcesByPath])

  useMarkdownEditorSsotSync({
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText: args.activeText,
    setActiveMarkdownDocument: args.setActiveMarkdownDocument,
    paused: args.viewerInlineEditActive,
  })

  React.useEffect(() => {
    const docKey = String(activeDocumentKey || '').trim()
    const markdownName = String(args.markdownDocumentName || '').trim()
    const nextText = typeof args.markdownDocumentText === 'string' ? args.markdownDocumentText : ''
    if (!docKey || !markdownName || !nextText) return
    if (!matchesMarkdownDocumentPath(docKey, markdownName)) return
    const active = String(args.activeTextRef.current || '')
    if (active === nextText) return
    const last = args.lastLoadedRef.current
    const hasUnsavedUserEdit = !!(
      args.userEditedActiveTextRef.current &&
      last &&
      last.path === args.activePath &&
      last.text !== active
    )
    if (hasUnsavedUserEdit) return
    if (args.activePath) {
      args.lastLoadedRef.current = { path: args.activePath, text: nextText }
      args.patchWorkspaceEntryInlineText(args.activePath, nextText)
    }
    args.setActiveTextProgrammatic(nextText)
  }, [
    activeDocumentKey,
    args.activePath,
    args.activeTextRef,
    args.lastLoadedRef,
    args.markdownDocumentName,
    args.markdownDocumentText,
    args.patchWorkspaceEntryInlineText,
    args.setActiveTextProgrammatic,
    args.userEditedActiveTextRef,
  ])

  React.useEffect(() => {
    const path = args.activePath
    if (!path) return

    const prev = args.prevCollapsedRef.current
    if (prev !== args.effectiveBottomPanelCollapsed) {
      args.prevCollapsedRef.current = args.effectiveBottomPanelCollapsed
      if (args.effectiveBottomPanelCollapsed) {
        args.collapsedSnapshotRef.current = { path, text: args.activeText }
        return
      }

      const snap = args.collapsedSnapshotRef.current
      const candidate =
        snap && snap.path === path && String(snap.text || '').trim()
          ? snap.text
          : (() => {
              const last = args.lastLoadedRef.current
              if (!last || last.path !== path) return ''
              return last.text
            })()

      if (String(args.activeText || '').trim() || !String(candidate || '').trim()) return
      args.setActiveText(candidate)
      if (activeDocumentKey) {
        void args.setActiveMarkdownDocument({
          name: activeDocumentKey,
          text: normalizeWebpageFrontmatterView(candidate, 'markdown'),
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          sourceUrl: activeDocumentSourceUrl,
        })
      }
      return
    }

    if (!args.effectiveBottomPanelCollapsed) return
    if (String(args.activeText || '').trim()) {
      args.collapsedSnapshotRef.current = { path, text: args.activeText }
      return
    }
    const snap = args.collapsedSnapshotRef.current
    if (!snap || snap.path !== path || !String(snap.text || '').trim()) return
    args.setActiveText(snap.text)
    if (activeDocumentKey) {
      void args.setActiveMarkdownDocument({
        name: activeDocumentKey,
        text: normalizeWebpageFrontmatterView(snap.text, 'markdown'),
        normalizeMermaidMmd: false,
        autoEnableFrontmatter: false,
        sourceUrl: activeDocumentSourceUrl,
      })
    }
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    args.activePath,
    args.activeText,
    args.collapsedSnapshotRef,
    args.effectiveBottomPanelCollapsed,
    args.lastLoadedRef,
    args.prevCollapsedRef,
    args.setActiveMarkdownDocument,
    args.setActiveText,
  ])

  React.useEffect(() => {
    if (args.effectiveBottomPanelCollapsed) return
    const path = args.activePath
    if (!path || String(args.activeText || '').trim()) return

    const last = args.lastLoadedRef.current
    if (last && last.path === path && String(last.text || '').trim()) {
      args.setActiveText(last.text)
      if (activeDocumentKey) {
        void args.setActiveMarkdownDocument({
          name: activeDocumentKey,
          text: normalizeWebpageFrontmatterView(last.text, 'markdown'),
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          sourceUrl: activeDocumentSourceUrl,
        })
      }
      return
    }
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    args.activePath,
    args.activeText,
    args.effectiveBottomPanelCollapsed,
    args.lastLoadedRef,
    args.setActiveMarkdownDocument,
    args.setActiveText,
  ])

  const createParentPath = React.useMemo<WorkspacePath>(() => {
    if (!selectionEntry) return WORKSPACE_ROOT_PATH
    if (selectionEntry.kind === 'folder') return selectionEntry.path
    if (selectionEntry.parentPath) return selectionEntry.parentPath
    return WORKSPACE_ROOT_PATH
  }, [selectionEntry])

  React.useEffect(() => {
    if (!args.entries.length || args.loading) return
    const preferValidationSeedForRenderer = args.canvas2dRenderer === 'flowEditor'
    const preferCustomValidationSeed =
      CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE &&
      TEST_VALIDATION_WORKSPACE_SEED_REL_PATH !== DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH

    if (!args.lastSetActivePath || preferCustomValidationSeed || preferValidationSeedForRenderer) {
      const startupPath = resolveWorkspaceStartupActivePath({
        workspaceFilePaths: args.entries.filter((entry): entry is WorkspaceEntry & { kind: 'file' } => entry.kind === 'file').map(entry => entry.path),
        activePath: args.activePath,
        preferValidationSeedForDefaultFamily: preferCustomValidationSeed || preferValidationSeedForRenderer,
        forceValidationSeedIfPresent: preferCustomValidationSeed,
      })
      if (startupPath && startupPath !== args.activePath) {
        setActivePathSafe(startupPath)
        return
      }
    }

    if (args.activePath && args.entries.some(entry => entry.path === args.activePath)) return

    const recent = args.lastRequestedActivePathRef.current
    const storeRecent = args.lastSetActivePath
    const isRecentlyRequested = (req: { path: WorkspacePath; atMs: number } | null) =>
      !!(args.activePath && req?.path === args.activePath && Date.now() - req.atMs < 2000)
    if (isRecentlyRequested(recent) || isRecentlyRequested(storeRecent)) return

    const firstFile = args.entries.find(entry => entry.kind === 'file')
    if (!firstFile) return
    setActivePathSafe(firstFile.path)
  }, [
    args.activePath,
    args.canvas2dRenderer,
    args.entries,
    args.lastRequestedActivePathRef,
    args.lastSetActivePath,
    args.loading,
    setActivePathSafe,
  ])

  React.useEffect(() => {
    const path = String(args.activePath || '').trim()
    if (!path) return
    const canonicalPath = toCanonicalKgcWorkspacePath(path)
    if (!canonicalPath || canonicalPath === path) return
    if (!args.entries.some(entry => entry.kind === 'file' && entry.path === canonicalPath)) return
    setActivePathSafe(canonicalPath)
    if (selectionPath === path) setSelectionPathSafe(canonicalPath)
  }, [args.activePath, args.entries, selectionPath, setActivePathSafe, setSelectionPathSafe])

  React.useEffect(() => {
    const path = args.activePath
    if (!path || activeEntryKind !== 'folder' || !args.activeRef.current) return
    args.setActiveTextProgrammatic('')
    args.setHighlightedLineRange(null)
    args.clearStatus()
  }, [activeEntryKind, args.activePath, args.activeRef, args.clearStatus, args.setActiveTextProgrammatic, args.setHighlightedLineRange])

  return {
    selectionPath,
    setSelectionPathSafe,
    setActivePathSafe,
    activeEntry,
    selectionEntry,
    activeEntryKind,
    activeEntryText,
    activeDocumentKey,
    activeDocumentSourceUrl,
    createParentPath,
    selectionPathRef,
  }
}
