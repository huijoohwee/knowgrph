import React from 'react'
import { useMarkdownEditorSsotSync } from '@/features/markdown-workspace/useMarkdownEditorSsotSync'
import { readWorkspaceActiveDocumentResolvedText } from '@/features/source-files/sourceFilesRuntimeActive'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { applyActiveMarkdownDocumentPayload } from '@/features/markdown/activeMarkdownDocument'
import type { MarkdownWorkspaceRuntimeSetActiveDocument } from './markdownWorkspaceRuntime.types'
import { resolveWorkspaceDirtyState } from './markdownWorkspaceRuntime.shared'
import { resolveMarkdownWorkspaceSelectionCollapseTransition } from './markdownWorkspaceSelectionCollapseTransition'
import { resolveMarkdownWorkspaceBootstrapActivePath } from './markdownWorkspaceSelectionBootstrap'
import { resolveMarkdownWorkspaceCanonicalSelection } from './markdownWorkspaceSelectionCanonicalPath'
import { deriveMarkdownWorkspaceSelectionState } from './markdownWorkspaceSelectionDerived'
import { normalizeMarkdownWorkspaceSelectionPath } from './markdownWorkspaceSelectionPath'
import { resolveMarkdownWorkspaceSelectionRestoreApply } from './markdownWorkspaceSelectionRestoreApply'
import { readMarkdownWorkspaceRestoreTextForPath } from './markdownWorkspaceSelectionRestore'
import { resolveMarkdownWorkspaceSelectionWritebackSync } from './markdownWorkspaceSelectionWriteback'
import { commitMarkdownWorkspaceWriteback } from './markdownWorkspaceWritebackCommit'
import {
  resolveActivePathFromWorkspaceFileSelection,
  resolveInitialMarkdownWorkspaceSelectionPath,
  resolveInvalidatedMarkdownWorkspaceSelectionPath,
} from './markdownWorkspaceSelectionSync'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexSharedContentCached } from '@/lib/hash/textHashCache'
import { buildWorkspaceEntriesIndex } from './workspaceEntriesIndex'
import type { MarkdownWorkspaceRuntimeGetFs } from './markdownWorkspaceRuntime.types'

export type MarkdownWorkspaceSelectionArgs = {
  activePath: WorkspacePath | null
  setActivePath: (path: WorkspacePath) => void
  entries: WorkspaceEntry[]
  loading: boolean
  activeText: string
  setActiveText: (text: string) => void
  setActiveTextProgrammatic: (text: string) => void
  markdownDocumentName: string
  markdownDocumentText: string
  graphDataSource?: string
  setActiveMarkdownDocument: MarkdownWorkspaceRuntimeSetActiveDocument
  getFs: MarkdownWorkspaceRuntimeGetFs
  sourcesByPath: WorkspaceSourceIndex
  viewerInlineEditActive: boolean
  activeRef: React.MutableRefObject<boolean>
  activeTextRef: React.MutableRefObject<string>
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  userEditedActiveTextRef: React.MutableRefObject<boolean>
  collapsedSnapshotRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  prevCollapsedRef: React.MutableRefObject<boolean>
  effectiveBottomSurfaceCollapsed: boolean
  canvas2dRenderer: string
  lastSetActivePath: { path: WorkspacePath; atMs: number } | null
  lastRequestedActivePathRef: React.MutableRefObject<{ path: WorkspacePath; atMs: number } | null>
  patchWorkspaceEntryInlineText: (path: WorkspacePath, text: string) => void
  clearStatus: () => void
  setHighlightedLineRange: (value: null) => void
}

function buildWorkspaceDocumentSwitchSignature(args: {
  activeDocumentKey: string
  text: string
  updatedAtMs: unknown
  graphDataSource?: string | null
}): string {
  const activeDocumentKey = String(args.activeDocumentKey || '').trim()
  const text = String(args.text || '')
  const textHash = hashStringToHexSharedContentCached(text, 'markdown-workspace-switch')
  const graphDataSource = String(args.graphDataSource || '').trim()
  return hashSignatureParts([
    'markdown-workspace-document-switch-apply',
    activeDocumentKey,
    text.length,
    textHash,
    typeof args.updatedAtMs === 'number' ? args.updatedAtMs : 0,
    graphDataSource,
  ])
}

export function shouldAcceptWorkspaceDocumentSelectionText(args: {
  activePath: WorkspacePath | null
  activeEntryKind: string
  activeDocumentKey?: string | null
  text: string
}): boolean {
  const activePath = String(args.activePath || '').trim()
  if (!activePath) return false
  if (args.activeEntryKind === 'folder') return false
  if (String(args.text || '').trim()) return true
  const activeDocumentKey = String(args.activeDocumentKey || '').trim()
  if (!activeDocumentKey) return false
  return !String(args.activeEntryKind || '').trim() || args.activeEntryKind === 'file'
}

export function shouldHydrateStableWorkspaceSelectionText(args: {
  activePath: WorkspacePath | null
  activeEntryKind: string
  activeDocumentKey?: string | null
  currentText: string
  nextText: string
  lastLoadedPath?: WorkspacePath | null
  userEditedActiveText: boolean
}): boolean {
  if (args.userEditedActiveText === true) return false
  if (!shouldAcceptWorkspaceDocumentSelectionText({
    activePath: args.activePath,
    activeEntryKind: args.activeEntryKind,
    activeDocumentKey: args.activeDocumentKey,
    text: args.nextText,
  })) {
    return false
  }
  const activePath = String(args.activePath || '').trim()
  if (!activePath) return false
  if (String(args.lastLoadedPath || '').trim() !== activePath) return true
  return String(args.currentText || '') !== String(args.nextText || '')
}

export function isWorkspaceGraphSourceStaleForDocument(args: {
  activeDocumentKey?: string | null
  graphDataSource?: string | null
}): boolean {
  const activeDocumentKey = String(args.activeDocumentKey || '').trim()
  if (!activeDocumentKey) return false
  const graphDataSource = String(args.graphDataSource || '').trim()
  const expectedMarkdownSource = `markdown:${activeDocumentKey}`
  return graphDataSource !== expectedMarkdownSource
}

function isWorkspaceGraphSourceConflictingMarkdownDocument(args: {
  activeDocumentKey?: string | null
  graphDataSource?: string | null
}): boolean {
  const activeDocumentKey = String(args.activeDocumentKey || '').trim()
  if (!activeDocumentKey) return false
  const graphDataSource = String(args.graphDataSource || '').trim()
  const expectedMarkdownSource = `markdown:${activeDocumentKey}`
  return graphDataSource.startsWith('markdown:') && graphDataSource !== expectedMarkdownSource
}

export function shouldApplyStableWorkspaceSelectionToCanvas(args: {
  activePath: WorkspacePath | null
  activeEntryKind: string
  activeDocumentKey?: string | null
  nextText: string
  markdownDocumentName: string
  markdownDocumentText: string
  graphDataSource?: string | null
}): boolean {
  if (!shouldAcceptWorkspaceDocumentSelectionText({
    activePath: args.activePath,
    activeEntryKind: args.activeEntryKind,
    activeDocumentKey: args.activeDocumentKey,
    text: args.nextText,
  })) {
    return false
  }
  const activeDocumentKey = String(args.activeDocumentKey || '').trim()
  if (!activeDocumentKey) return false
  if (isWorkspaceGraphSourceStaleForDocument({
    activeDocumentKey,
    graphDataSource: args.graphDataSource,
  })) {
    return true
  }
  return (
    String(args.markdownDocumentName || '').trim() !== activeDocumentKey ||
    String(args.markdownDocumentText || '') !== String(args.nextText || '')
  )
}

export function useMarkdownWorkspaceSelection(args: MarkdownWorkspaceSelectionArgs) {
  const storageFallbackByPathRef = React.useRef<Map<string, string>>(new Map())
  const setActivePathSafe = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = normalizeMarkdownWorkspaceSelectionPath(path)
      if (!normalized) return
      args.lastRequestedActivePathRef.current = { path: normalized, atMs: Date.now() }
      args.setActivePath(normalized)
    },
    [args.lastRequestedActivePathRef, args.setActivePath],
  )

  const [selectionPath, setSelectionPath] = React.useState<WorkspacePath | null>(null)
  const selectionPathRef = React.useRef<WorkspacePath | null>(null)
  const pendingSelectionPathRef = React.useRef<WorkspacePath | null>(null)
  if (pendingSelectionPathRef.current === selectionPath) {
    pendingSelectionPathRef.current = null
  }
  selectionPathRef.current = pendingSelectionPathRef.current || selectionPath

  const setSelectionPathSafe = React.useCallback((path: WorkspacePath) => {
    const normalized = normalizeMarkdownWorkspaceSelectionPath(path)
    pendingSelectionPathRef.current = normalized
    selectionPathRef.current = normalized
    setSelectionPath(normalized)
  }, [])

  const entriesIndex = React.useMemo(() => buildWorkspaceEntriesIndex(args.entries), [args.entries])

  React.useEffect(() => {
    const nextSelectionPath = resolveInitialMarkdownWorkspaceSelectionPath({
      selectionPath: selectionPathRef.current,
      activePath: args.activePath,
    })
    if (!nextSelectionPath) return
    setSelectionPath(nextSelectionPath)
  }, [args.activePath])

  React.useEffect(() => {
    const nextSelectionPath = resolveInvalidatedMarkdownWorkspaceSelectionPath({
      selectionPath,
      activePath: args.activePath,
      entriesIndex,
      loading: args.loading,
    })
    if (typeof nextSelectionPath === 'undefined') return
    setSelectionPath(nextSelectionPath)
  }, [args.activePath, args.loading, entriesIndex, selectionPath])

  const {
    activeEntry,
    selectionEntry,
    activeEntryKind,
    activeEntryText,
    activeDocumentKey,
    activeDocumentSourceUrl,
    createParentPath,
  } = React.useMemo(
    () =>
      deriveMarkdownWorkspaceSelectionState({
        activePath: args.activePath,
        selectionPath,
        entriesIndex,
        sourcesByPath: args.sourcesByPath,
      }),
    [args.activePath, args.sourcesByPath, entriesIndex, selectionPath],
  )

  React.useEffect(() => {
    const nextActivePath = resolveActivePathFromWorkspaceFileSelection({
      selectionPath,
      activePath: args.activePath,
      selectionEntryKind: selectionEntry?.kind ?? null,
    })
    if (!nextActivePath) return
    setActivePathSafe(nextActivePath)
  }, [args.activePath, selectionEntry?.kind, selectionPath, setActivePathSafe])

  const previousActivePathRef = React.useRef<WorkspacePath | null>(args.activePath)
  const switchedActivePathRef = React.useRef<{ prev: WorkspacePath; next: WorkspacePath } | null>(null)
  React.useEffect(() => {
    const nextPath = args.activePath
    const prevPath = previousActivePathRef.current
    previousActivePathRef.current = nextPath
    if (nextPath && prevPath && prevPath !== nextPath) {
      switchedActivePathRef.current = { prev: prevPath, next: nextPath }
    }
    if (!nextPath || !prevPath || prevPath === nextPath || activeEntryKind === 'folder' || !args.activeRef.current) return
    const currentText = String(args.activeTextRef.current || '')
    if (!currentText) return
    const lastLoaded = args.lastLoadedRef.current
    if (lastLoaded?.path === nextPath && String(lastLoaded.text || '') === currentText) return
    args.setActiveTextProgrammatic('')
    args.setHighlightedLineRange(null)
    args.clearStatus()
  }, [
    activeEntryKind,
    args.activePath,
    args.activeRef,
    args.activeTextRef,
    args.clearStatus,
    args.lastLoadedRef,
    args.setActiveTextProgrammatic,
    args.setHighlightedLineRange,
  ])

  React.useEffect(() => {
    const switched = switchedActivePathRef.current
    if (!switched) return
    const nextPath = switched.next
    if (nextPath !== args.activePath) return
    if (activeEntryKind === 'folder') return
    let cancelled = false
    const run = async () => {
      let nextText = typeof activeEntryText === 'string' ? String(activeEntryText) : ''
      if (!nextText.trim()) {
        const fs = await args.getFs()
        if (cancelled || switchedActivePathRef.current?.next !== nextPath || args.activePath !== nextPath) return
        nextText = await readWorkspaceActiveDocumentResolvedText({
          activePath: nextPath,
          currentText: nextText,
          fs,
          storageFallbackByPath: storageFallbackByPathRef.current,
        })
      }
      if (!shouldAcceptWorkspaceDocumentSelectionText({
        activePath: nextPath,
        activeEntryKind,
        activeDocumentKey,
        text: nextText,
      })) {
        return
      }
      if (cancelled || switchedActivePathRef.current?.next !== nextPath || args.activePath !== nextPath) return
      const currentText = String(args.activeTextRef.current || '')
      if (currentText !== nextText) {
        args.setActiveTextProgrammatic(nextText)
      }
      args.lastLoadedRef.current = { path: nextPath, text: nextText }
      args.patchWorkspaceEntryInlineText(nextPath, nextText)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    activeEntryKind,
    activeEntryText,
    activeDocumentKey,
    args.activePath,
    args.activeTextRef,
    args.getFs,
    args.lastLoadedRef,
    args.patchWorkspaceEntryInlineText,
    args.setActiveTextProgrammatic,
  ])

  const lastDocumentSwitchApplySigRef = React.useRef<string>('')
  const documentSwitchApplyInFlightSigRef = React.useRef<string>('')
  const lastDocumentSwitchApplyAttemptRef = React.useRef<{ sig: string; atMs: number }>({ sig: '', atMs: 0 })
  const documentSwitchApplyRetryTimerRef = React.useRef<number | null>(null)
  const [documentSwitchApplyRetryTick, setDocumentSwitchApplyRetryTick] = React.useState(0)
  const scheduleDocumentSwitchApplyRetry = React.useCallback((path: WorkspacePath) => {
    const normalizedPath = normalizeMarkdownWorkspaceSelectionPath(path)
    if (!normalizedPath) return
    if (documentSwitchApplyRetryTimerRef.current != null) {
      window.clearTimeout(documentSwitchApplyRetryTimerRef.current)
      documentSwitchApplyRetryTimerRef.current = null
    }
    documentSwitchApplyRetryTimerRef.current = window.setTimeout(() => {
      documentSwitchApplyRetryTimerRef.current = null
      if (switchedActivePathRef.current?.next !== normalizedPath) return
      if (args.activePath !== normalizedPath) return
      setDocumentSwitchApplyRetryTick(tick => tick + 1)
    }, 450)
  }, [args.activePath])
  React.useEffect(() => {
    return () => {
      if (documentSwitchApplyRetryTimerRef.current != null) {
        window.clearTimeout(documentSwitchApplyRetryTimerRef.current)
        documentSwitchApplyRetryTimerRef.current = null
      }
    }
  }, [])
  const applySelectedWorkspaceDocumentToCanvas = React.useCallback(async (applyArgs: {
    activeDocumentKey: string
    text: string
    sourceUrl: string | null
    updatedAtMs: unknown
    graphDataSource?: string | null
  }) => {
    const nextSig = buildWorkspaceDocumentSwitchSignature({
      activeDocumentKey: applyArgs.activeDocumentKey,
      text: applyArgs.text,
      updatedAtMs: applyArgs.updatedAtMs,
      graphDataSource: applyArgs.graphDataSource,
    })
    const nowMs = Date.now()
    const lastAttempt = lastDocumentSwitchApplyAttemptRef.current
    const graphSourceStaleForDocument = isWorkspaceGraphSourceStaleForDocument({
      activeDocumentKey: applyArgs.activeDocumentKey,
      graphDataSource: applyArgs.graphDataSource,
    })
    const graphSourceConflictingMarkdownDocument = isWorkspaceGraphSourceConflictingMarkdownDocument({
      activeDocumentKey: applyArgs.activeDocumentKey,
      graphDataSource: applyArgs.graphDataSource,
    })
    if (
      lastAttempt.sig === nextSig &&
      nowMs - lastAttempt.atMs < 400
    ) {
      return false
    }
    if (documentSwitchApplyInFlightSigRef.current === nextSig) return false
    const shouldReplayCompletedApplyForMarkdownConflict =
      graphSourceStaleForDocument && graphSourceConflictingMarkdownDocument
    if (!shouldReplayCompletedApplyForMarkdownConflict && lastDocumentSwitchApplySigRef.current === nextSig) return false
    lastDocumentSwitchApplyAttemptRef.current = { sig: nextSig, atMs: nowMs }
    documentSwitchApplyInFlightSigRef.current = nextSig
    try {
      const applied = await applyActiveMarkdownDocumentPayload({
        setActiveMarkdownDocument: args.setActiveMarkdownDocument,
        name: applyArgs.activeDocumentKey,
        text: applyArgs.text,
        sourceUrl: applyArgs.sourceUrl,
        autoEnableFrontmatter: true,
        applyViewPreset: true,
        applyToGraph: true,
        forceApplyToGraph: true,
        normalizeWebpageFrontmatterToMarkdown: false,
      })
      if (applied === true) {
        lastDocumentSwitchApplySigRef.current = nextSig
        return true
      }
      return false
    } finally {
      if (documentSwitchApplyInFlightSigRef.current === nextSig) {
        documentSwitchApplyInFlightSigRef.current = ''
      }
    }
  }, [args.setActiveMarkdownDocument])

  React.useEffect(() => {
    const switched = switchedActivePathRef.current
    if (!switched) return
    if (switched.next !== args.activePath) return
    if (activeEntryKind === 'folder') return
    if (!activeDocumentKey) return
    const inlineText = typeof activeEntryText === 'string' ? activeEntryText : ''
    const loaded = args.lastLoadedRef.current
    let cancelled = false
    void (async () => {
      let nextText = inlineText.trim()
        ? inlineText
        : loaded?.path === switched.next
          ? String(loaded.text || '')
          : ''
      if (!nextText.trim()) {
        const fs = await args.getFs()
        if (cancelled || switchedActivePathRef.current?.next !== switched.next || args.activePath !== switched.next) return
        nextText = await readWorkspaceActiveDocumentResolvedText({
          activePath: switched.next,
          currentText: nextText,
          fs,
          storageFallbackByPath: storageFallbackByPathRef.current,
        })
      }
      if (!shouldAcceptWorkspaceDocumentSelectionText({
        activePath: switched.next,
        activeEntryKind,
        activeDocumentKey,
        text: nextText,
      })) {
        return
      }
      if (cancelled || switchedActivePathRef.current?.next !== switched.next || args.activePath !== switched.next) return

      args.lastLoadedRef.current = { path: switched.next, text: nextText }
      args.patchWorkspaceEntryInlineText(switched.next, nextText)
      const applied = await applySelectedWorkspaceDocumentToCanvas({
        activeDocumentKey,
        text: nextText,
        sourceUrl: activeDocumentSourceUrl,
        updatedAtMs: activeEntry?.updatedAtMs,
        graphDataSource: args.graphDataSource,
      })
      if (applied && switchedActivePathRef.current?.next === switched.next) {
        switchedActivePathRef.current = null
      } else if (!applied && switchedActivePathRef.current?.next === switched.next) {
        scheduleDocumentSwitchApplyRetry(switched.next)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    args.activePath,
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeEntry,
    activeEntryKind,
    activeEntryText,
    args.graphDataSource,
    args.getFs,
    args.lastLoadedRef,
    args.patchWorkspaceEntryInlineText,
    documentSwitchApplyRetryTick,
    applySelectedWorkspaceDocumentToCanvas,
    scheduleDocumentSwitchApplyRetry,
  ])

  React.useEffect(() => {
    const path = args.activePath
    if (!path || activeEntryKind === 'folder') return
    let cancelled = false
    const run = async () => {
      let nextText = typeof activeEntryText === 'string' ? activeEntryText : ''
      if (!nextText.trim()) {
        const fs = await args.getFs()
        if (cancelled || args.activePath !== path) return
        nextText = await readWorkspaceActiveDocumentResolvedText({
          activePath: path,
          currentText: nextText,
          fs,
          storageFallbackByPath: storageFallbackByPathRef.current,
        })
      }
      if (!shouldHydrateStableWorkspaceSelectionText({
        activePath: path,
        activeEntryKind,
        activeDocumentKey,
        currentText: String(args.activeTextRef.current || ''),
        nextText,
        lastLoadedPath: args.lastLoadedRef.current?.path || null,
        userEditedActiveText: args.userEditedActiveTextRef.current === true,
      }) && !shouldApplyStableWorkspaceSelectionToCanvas({
        activePath: path,
        activeEntryKind,
        activeDocumentKey,
        nextText,
        markdownDocumentName: args.markdownDocumentName,
        markdownDocumentText: args.markdownDocumentText,
        graphDataSource: args.graphDataSource,
      })) {
        return
      }
      if (cancelled || args.activePath !== path) return
      if (String(args.activeTextRef.current || '') !== nextText) {
        args.setActiveTextProgrammatic(nextText)
      }
      args.lastLoadedRef.current = { path, text: nextText }
      args.patchWorkspaceEntryInlineText(path, nextText)
      if (activeDocumentKey) {
        await applySelectedWorkspaceDocumentToCanvas({
          activeDocumentKey,
          text: nextText,
          sourceUrl: activeDocumentSourceUrl,
          updatedAtMs: activeEntry?.updatedAtMs,
          graphDataSource: args.graphDataSource,
        })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    activeEntryKind,
    activeEntryText,
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeEntry,
    args.activePath,
    args.activeTextRef,
    args.graphDataSource,
    args.getFs,
    args.lastLoadedRef,
    args.markdownDocumentName,
    args.markdownDocumentText,
    args.patchWorkspaceEntryInlineText,
    args.setActiveTextProgrammatic,
    args.userEditedActiveTextRef,
    applySelectedWorkspaceDocumentToCanvas,
  ])

  useMarkdownEditorSsotSync({
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText: args.activeText,
    activeTextOwnedByActivePath: !!(args.activePath && args.lastLoadedRef.current?.path === args.activePath),
    setActiveMarkdownDocument: args.setActiveMarkdownDocument,
    paused: args.viewerInlineEditActive,
  })

  React.useEffect(() => {
    const writebackSync = resolveMarkdownWorkspaceSelectionWritebackSync({
      activePath: args.activePath,
      activeDocumentKey,
      markdownDocumentName: args.markdownDocumentName,
      markdownDocumentText: args.markdownDocumentText,
    })
    if (!writebackSync) return
    const nextText = writebackSync.nextText
    const active = String(args.activeTextRef.current || '')
    if (active === nextText) return
    const hasUnsavedUserEdit = !!(
      args.activePath &&
      resolveWorkspaceDirtyState({
        path: args.activePath,
        lastLoadedRef: args.lastLoadedRef,
        activeTextRef: args.activeTextRef,
        userEditedActiveTextRef: args.userEditedActiveTextRef,
      })
    )
    if (hasUnsavedUserEdit) return
    if (args.activePath) {
      commitMarkdownWorkspaceWriteback({
        path: args.activePath,
        text: nextText,
        lastLoadedRef: args.lastLoadedRef,
        patchWorkspaceEntryInlineText: args.patchWorkspaceEntryInlineText,
        setActiveTextProgrammatic: args.setActiveTextProgrammatic,
      })
    } else {
      args.setActiveTextProgrammatic(nextText)
    }
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
    const transition = resolveMarkdownWorkspaceSelectionCollapseTransition({
      path,
      prevCollapsed: prev,
      collapsed: args.effectiveBottomSurfaceCollapsed,
      activeText: args.activeText,
      collapsedSnapshot: args.collapsedSnapshotRef.current,
      lastLoaded: args.lastLoadedRef.current,
    })
    if (prev !== args.effectiveBottomSurfaceCollapsed) {
      args.prevCollapsedRef.current = args.effectiveBottomSurfaceCollapsed
    }

    if (transition.kind === 'capture-transition' || transition.kind === 'capture-collapsed') {
      args.collapsedSnapshotRef.current = transition.snapshot
      return
    }

    if (transition.kind !== 'restore-transition' && transition.kind !== 'restore-collapsed') return
    const restoredSelection = resolveMarkdownWorkspaceSelectionRestoreApply({
      text: transition.text,
      activeDocumentKey,
      activeDocumentSourceUrl,
    })
    args.setActiveText(restoredSelection.text)
    if (restoredSelection.restoredActiveDocumentArgs) {
        void applyActiveMarkdownDocumentPayload({
          setActiveMarkdownDocument: args.setActiveMarkdownDocument,
          ...restoredSelection.restoredActiveDocumentArgs,
        })
    }
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    args.activePath,
    args.activeText,
    args.collapsedSnapshotRef,
    args.effectiveBottomSurfaceCollapsed,
    args.lastLoadedRef,
    args.prevCollapsedRef,
    args.setActiveMarkdownDocument,
    args.setActiveText,
  ])

  React.useEffect(() => {
    if (args.effectiveBottomSurfaceCollapsed) return
    const path = args.activePath
    if (!path || String(args.activeText || '').trim()) return

    const lastText = readMarkdownWorkspaceRestoreTextForPath(args.lastLoadedRef.current, path)
    if (lastText) {
      const restoredSelection = resolveMarkdownWorkspaceSelectionRestoreApply({
        text: lastText,
        activeDocumentKey,
        activeDocumentSourceUrl,
      })
      args.setActiveText(restoredSelection.text)
      if (restoredSelection.restoredActiveDocumentArgs) {
          void applyActiveMarkdownDocumentPayload({
            setActiveMarkdownDocument: args.setActiveMarkdownDocument,
            ...restoredSelection.restoredActiveDocumentArgs,
          })
      }
      return
    }
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    args.activePath,
    args.activeText,
    args.effectiveBottomSurfaceCollapsed,
    args.lastLoadedRef,
    args.setActiveMarkdownDocument,
    args.setActiveText,
  ])

  React.useEffect(() => {
    if (!entriesIndex.byPath.size || args.loading) return
    const nextActivePath = resolveMarkdownWorkspaceBootstrapActivePath({
      entriesIndex,
      activePath: args.activePath,
      lastSetActivePath: args.lastSetActivePath,
      lastRequestedActivePath: args.lastRequestedActivePathRef.current,
    })
    if (!nextActivePath || nextActivePath === args.activePath) return
    setActivePathSafe(nextActivePath)
  }, [
    args.activePath,
    args.lastRequestedActivePathRef,
    args.lastSetActivePath,
    args.loading,
    entriesIndex,
    setActivePathSafe,
  ])

  React.useEffect(() => {
    const canonicalSelection = resolveMarkdownWorkspaceCanonicalSelection({
      activePath: args.activePath,
      selectionPath,
      entriesIndex,
    })
    if (!canonicalSelection) return
    setActivePathSafe(canonicalSelection.activePath)
    if (canonicalSelection.selectionPath) setSelectionPathSafe(canonicalSelection.selectionPath)
  }, [args.activePath, entriesIndex, selectionPath, setActivePathSafe, setSelectionPathSafe])

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
