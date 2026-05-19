import React from 'react'
import { useMarkdownEditorSsotSync } from '@/features/markdown-workspace/useMarkdownEditorSsotSync'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { applyActiveMarkdownDocumentPayload } from '@/features/markdown/activeMarkdownDocument'
import type { MarkdownWorkspaceRuntimeSetActiveDocument } from './markdownWorkspaceRuntime.types'
import {
  resolveWorkspaceDirtyState,
} from './markdownWorkspaceRuntime.shared'
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
  resolveInitialMarkdownWorkspaceSelectionPath,
  resolveInvalidatedMarkdownWorkspaceSelectionPath,
} from './markdownWorkspaceSelectionSync'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import {
  buildCanvasWorkspacePresetSwitchSemanticKey,
  hasCanvasWorkspacePresetForSwitch,
  readCanvasWorkspacePresetSwitchContext,
} from './workspaceSwitchPreset'
import { buildWorkspaceEntriesIndex } from './workspaceEntriesIndex'

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
  setActiveMarkdownDocument: MarkdownWorkspaceRuntimeSetActiveDocument
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
}): string {
  const activeDocumentKey = String(args.activeDocumentKey || '').trim()
  const text = String(args.text || '')
  const textHash = hashStringToHexCached(`markdown-workspace-switch:${activeDocumentKey || 'document'}`, text)
  return hashSignatureParts([
    'markdown-workspace-document-switch-apply',
    activeDocumentKey,
    text.length,
    textHash,
    typeof args.updatedAtMs === 'number' ? args.updatedAtMs : 0,
  ])
}

export function useMarkdownWorkspaceSelection(args: MarkdownWorkspaceSelectionArgs) {
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
  selectionPathRef.current = selectionPath

  const setSelectionPathSafe = React.useCallback((path: WorkspacePath) => {
    setSelectionPath(normalizeMarkdownWorkspaceSelectionPath(path))
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

  const previousActivePathRef = React.useRef<WorkspacePath | null>(args.activePath)
  const switchedActivePathRef = React.useRef<{ prev: WorkspacePath; next: WorkspacePath } | null>(null)
  React.useEffect(() => {
    const nextPath = args.activePath
    const prevPath = previousActivePathRef.current
    previousActivePathRef.current = nextPath
    switchedActivePathRef.current =
      nextPath && prevPath && prevPath !== nextPath
        ? { prev: prevPath, next: nextPath }
        : null
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
    if (activeEntryKind === 'folder') return
    const nextText = typeof activeEntryText === 'string' ? String(activeEntryText) : ''
    if (!nextText.trim()) return
    const currentText = String(args.activeTextRef.current || '')
    if (currentText === nextText) return
    args.setActiveTextProgrammatic(nextText)
    args.lastLoadedRef.current = { path: nextPath, text: nextText }
  }, [
    activeEntryKind,
    activeEntryText,
    args.activePath,
    args.activeTextRef,
    args.lastLoadedRef,
    args.setActiveTextProgrammatic,
  ])

  const lastFrontmatterSwitchApplySigRef = React.useRef<string>('')
  const frontmatterSwitchApplyInFlightSigRef = React.useRef<string>('')
  const lastFrontmatterSwitchApplyAttemptRef = React.useRef<{ sig: string; atMs: number }>({ sig: '', atMs: 0 })
  const cancelFrontmatterSwitchApply = React.useCallback(() => {
    lastFrontmatterSwitchApplySigRef.current = ''
    frontmatterSwitchApplyInFlightSigRef.current = ''
    lastFrontmatterSwitchApplyAttemptRef.current = { sig: '', atMs: 0 }
  }, [])
  React.useEffect(() => cancelFrontmatterSwitchApply, [cancelFrontmatterSwitchApply])
  React.useEffect(() => {
    if (activeEntryKind === 'folder') {
      cancelFrontmatterSwitchApply()
      return
    }
    if (!activeDocumentKey) {
      cancelFrontmatterSwitchApply()
      return
    }
    const nextText = typeof activeEntryText === 'string' ? activeEntryText : ''
    if (!nextText.trim()) {
      cancelFrontmatterSwitchApply()
      return
    }
    const presetContext = readCanvasWorkspacePresetSwitchContext(nextText)
    if (!presetContext) {
      cancelFrontmatterSwitchApply()
      return
    }

    const nextSig = buildCanvasWorkspacePresetSwitchSemanticKey({
      activeDocumentKey,
      rawBlock: presetContext.rawBlock,
      updatedAtMs: activeEntry?.updatedAtMs,
    })
    const nowMs = Date.now()
    const lastAttempt = lastFrontmatterSwitchApplyAttemptRef.current
    if (
      lastAttempt.sig === nextSig &&
      nowMs - lastAttempt.atMs < 400
    ) {
      return
    }
    if (frontmatterSwitchApplyInFlightSigRef.current === nextSig) return
    if (lastFrontmatterSwitchApplySigRef.current === nextSig) return
    lastFrontmatterSwitchApplyAttemptRef.current = { sig: nextSig, atMs: nowMs }
    frontmatterSwitchApplyInFlightSigRef.current = nextSig
    lastFrontmatterSwitchApplySigRef.current = nextSig

    void (async () => {
      try {
        await applyActiveMarkdownDocumentPayload({
          setActiveMarkdownDocument: args.setActiveMarkdownDocument,
          name: activeDocumentKey,
          text: nextText,
          sourceUrl: activeDocumentSourceUrl,
          autoEnableFrontmatter: false,
          applyViewPreset: false,
          applyToGraph: false,
          canvasWorkspacePreset: presetContext.preset,
          normalizeWebpageFrontmatterToMarkdown: false,
        })
      } finally {
        if (frontmatterSwitchApplyInFlightSigRef.current === nextSig) {
          frontmatterSwitchApplyInFlightSigRef.current = ''
        }
      }
    })()
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeEntry,
    activeEntryKind,
    activeEntryText,
    cancelFrontmatterSwitchApply,
    args.setActiveMarkdownDocument,
  ])

  const lastDocumentSwitchApplySigRef = React.useRef<string>('')
  const documentSwitchApplyInFlightSigRef = React.useRef<string>('')
  const lastDocumentSwitchApplyAttemptRef = React.useRef<{ sig: string; atMs: number }>({ sig: '', atMs: 0 })
  React.useEffect(() => {
    const switched = switchedActivePathRef.current
    if (!switched) return
    if (activeEntryKind === 'folder') return
    if (!activeDocumentKey) return
    const nextText = typeof activeEntryText === 'string' ? activeEntryText : ''
    if (!nextText.trim()) return
    if (hasCanvasWorkspacePresetForSwitch(nextText)) return

    const nextSig = buildWorkspaceDocumentSwitchSignature({
      activeDocumentKey,
      text: nextText,
      updatedAtMs: activeEntry?.updatedAtMs,
    })
    const nowMs = Date.now()
    const lastAttempt = lastDocumentSwitchApplyAttemptRef.current
    if (
      lastAttempt.sig === nextSig &&
      nowMs - lastAttempt.atMs < 400
    ) {
      return
    }
    if (documentSwitchApplyInFlightSigRef.current === nextSig) return
    if (lastDocumentSwitchApplySigRef.current === nextSig) return
    lastDocumentSwitchApplyAttemptRef.current = { sig: nextSig, atMs: nowMs }
    documentSwitchApplyInFlightSigRef.current = nextSig
    lastDocumentSwitchApplySigRef.current = nextSig
    void (async () => {
      try {
        await applyActiveMarkdownDocumentPayload({
          setActiveMarkdownDocument: args.setActiveMarkdownDocument,
          name: activeDocumentKey,
          text: nextText,
          sourceUrl: activeDocumentSourceUrl,
          autoEnableFrontmatter: false,
          applyViewPreset: false,
          applyToGraph: false,
          normalizeWebpageFrontmatterToMarkdown: false,
        })
      } finally {
        if (documentSwitchApplyInFlightSigRef.current === nextSig) {
          documentSwitchApplyInFlightSigRef.current = ''
        }
      }
    })()
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeEntry,
    activeEntryKind,
    activeEntryText,
    args.setActiveMarkdownDocument,
  ])

  useMarkdownEditorSsotSync({
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText: args.activeText,
    setActiveMarkdownDocument: args.setActiveMarkdownDocument,
    paused: args.viewerInlineEditActive,
  })

  React.useEffect(() => {
    const writebackSync = resolveMarkdownWorkspaceSelectionWritebackSync({
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
