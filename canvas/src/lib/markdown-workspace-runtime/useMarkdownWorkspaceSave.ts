import React from 'react'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { normalizeWorkspacePath, workspaceBasename, workspaceExtLower, workspaceStem, WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { shouldAutosaveWorkspaceFile } from '@/components/BottomPanel/markdownWorkspace/workspaceAutosave'
import {
  cancelMarkdownWorkspaceAutosaveSync,
  scheduleMarkdownWorkspaceAutosaveSync,
} from './markdownWorkspaceRuntime.stateSync'
import { syncWorkspaceTextState, writeWorkspaceFileAndSync } from './markdownWorkspaceRuntime.io'
import type { MarkdownWorkspaceRuntimeGetFs, MarkdownWorkspaceRuntimeSetActiveDocument } from './markdownWorkspaceRuntime.types'

export type MarkdownWorkspaceSaveArgs = {
  active: boolean
  viewerInlineEditActive: boolean
  activePath: WorkspacePath | null
  activeEntryKind: string | null
  activeText: string
  debouncedText: string
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  getFs: MarkdownWorkspaceRuntimeGetFs
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  patchWorkspaceEntryInlineText: (path: WorkspacePath, text: string) => void
  setActiveMarkdownDocument: MarkdownWorkspaceRuntimeSetActiveDocument
  setGraphRagWorkflowJsonText: (text: string) => void
  setStatusProgress: (
    label: string,
    value?: number,
    max?: number,
    bytesDone?: number,
    bytesTotal?: number,
    opts?: { ttlMs?: number },
  ) => void
  setStatusWithAutoClear: (label: string, ttlMs?: number) => void
  setStatusError: (label: string) => void
  setActiveTextProgrammatic: (next: string) => void
  refresh: () => Promise<unknown>
  setActivePathSafe: (path: WorkspacePath) => void
  setSelectionPathSafe: (path: WorkspacePath) => void
  userEditedActiveTextRef: React.MutableRefObject<boolean>
}

export function useMarkdownWorkspaceSave(args: MarkdownWorkspaceSaveArgs) {
  const autosaveInFlightRef = React.useRef(false)
  const autosavePendingRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const autosaveStatusTimerRef = React.useRef<number | null>(null)

  const saveActiveFileNow = React.useCallback(async () => {
    const path = args.activePath
    if (!path || args.activeEntryKind === 'folder') return
    try {
      args.setStatusProgress('Saving', undefined, undefined, undefined, undefined, {
        ttlMs: UI_TOAST_TTL_MS.progressExtended,
      })
      try {
        const store = (await import('@/hooks/useGraphStore')).useGraphStore.getState()
        store.flushComposedPositionWritesNow()
      } catch {
        void 0
      }
      await writeWorkspaceFileAndSync({
        path,
        text: args.activeText,
        getFs: args.getFs,
        lastLoadedRef: args.lastLoadedRef,
        patchWorkspaceEntryInlineText: args.patchWorkspaceEntryInlineText,
        activeDocumentKey: args.activeDocumentKey,
        activeDocumentSourceUrl: args.activeDocumentSourceUrl,
        setActiveMarkdownDocument: args.setActiveMarkdownDocument,
        setGraphRagWorkflowJsonText: args.setGraphRagWorkflowJsonText,
        resetParsedState: true,
      })
      args.setStatusWithAutoClear('Saved')
    } catch (e) {
      args.setStatusError(`Save failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [args])

  const saveAsActiveFileNow = React.useCallback(async () => {
    const currentPath = args.activePath
    if (!currentPath || args.activeEntryKind === 'folder') return
    const normalized = normalizeWorkspacePath(currentPath)
    const parentPath = (() => {
      const idx = normalized.lastIndexOf('/')
      if (idx <= 0) return WORKSPACE_ROOT_PATH
      return normalizeWorkspacePath(normalized.slice(0, idx) || WORKSPACE_ROOT_PATH)
    })()
    const ext = workspaceExtLower(normalized) || 'md'
    const base = workspaceStem(normalized) || workspaceBasename(normalized) || 'note'
    const suggested = `${base}-copy.${ext}`
    const draft = typeof window !== 'undefined' ? window.prompt('Save As', suggested) : suggested
    const raw = String(draft || '').trim()
    if (!raw) {
      args.setStatusWithAutoClear('Save cancelled', UI_TOAST_TTL_MS.statusAutoCloseFast)
      return
    }
    const safeName = raw
      .replace(/\\/g, '/')
      .replace(/\s+/g, ' ')
      .replace(/\.+\//g, '')
      .replace(/\//g, '-')
      .replace(/\.{2,}/g, '.')
      .trim()
    const finalName = safeName.includes('.') ? safeName : `${safeName}.${ext}`

    try {
      args.setStatusProgress('Saving', undefined, undefined, undefined, undefined, {
        ttlMs: UI_TOAST_TTL_MS.progressExtended,
      })
      try {
        const store = (await import('@/hooks/useGraphStore')).useGraphStore.getState()
        store.flushComposedPositionWritesNow()
      } catch {
        void 0
      }
      const fs = await args.getFs()
      const createdPath = await fs.createFile({ parentPath, name: finalName, text: args.activeText })
      setWorkspaceEntrySource(createdPath, { kind: 'local', originalName: null })
      await args.refresh()
      syncWorkspaceTextState({
        path: createdPath,
        text: args.activeText,
        lastLoadedRef: args.lastLoadedRef,
        setActiveText: args.setActiveTextProgrammatic,
      })
      args.setActivePathSafe(createdPath)
      args.setSelectionPathSafe(createdPath)
      args.setStatusWithAutoClear('Saved as')
    } catch (e) {
      args.setStatusError(`Save failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [args])

  React.useEffect(() => {
    if (!args.active || args.viewerInlineEditActive) return
    const path = args.activePath
    if (!path || args.activeEntryKind === 'folder') return
    const last = args.lastLoadedRef.current
    if (!args.userEditedActiveTextRef.current) return
    if (!shouldAutosaveWorkspaceFile({ path, lastLoaded: last, activeText: args.activeText, debouncedText: args.debouncedText })) {
      return
    }
    scheduleMarkdownWorkspaceAutosaveSync(() => {
      if (autosaveInFlightRef.current) {
        autosavePendingRef.current = { path, text: args.debouncedText }
        return
      }
      autosaveInFlightRef.current = true
      void (async () => {
        let nextTextToSave = args.debouncedText
        try {
          while (true) {
            let savingShown = false
            autosaveStatusTimerRef.current = window.setTimeout(() => {
              args.setStatusProgress('Saving', undefined, undefined, undefined, undefined, {
                ttlMs: UI_TOAST_TTL_MS.progressExtended,
              })
              savingShown = true
            }, 220)
            try {
              await writeWorkspaceFileAndSync({
                path,
                text: nextTextToSave,
                getFs: args.getFs,
                lastLoadedRef: args.lastLoadedRef,
                patchWorkspaceEntryInlineText: args.patchWorkspaceEntryInlineText,
                activeDocumentKey: args.activeDocumentKey,
                activeDocumentSourceUrl: args.activeDocumentSourceUrl,
                setActiveMarkdownDocument: args.setActiveMarkdownDocument,
                setGraphRagWorkflowJsonText: args.setGraphRagWorkflowJsonText,
                resetParsedState: false,
              })
              if (savingShown) args.setStatusWithAutoClear('Saved')
            } finally {
              const timer = autosaveStatusTimerRef.current
              if (timer != null) window.clearTimeout(timer)
              autosaveStatusTimerRef.current = null
            }

            const pending = autosavePendingRef.current
            if (!pending || pending.path !== path || pending.text === nextTextToSave) {
              if (pending && pending.path !== path) autosavePendingRef.current = pending
              break
            }
            autosavePendingRef.current = null
            nextTextToSave = pending.text
          }
        } catch (e) {
          args.setStatusError(`Save failed: ${String((e as { message?: unknown })?.message ?? e)}`)
        } finally {
          autosaveInFlightRef.current = false
        }
      })()
    }, { path, text: args.debouncedText })
    return () => {
      cancelMarkdownWorkspaceAutosaveSync(path)
    }
  }, [args])

  React.useEffect(() => {
    return () => {
      const timer = autosaveStatusTimerRef.current
      if (timer != null) window.clearTimeout(timer)
      autosaveStatusTimerRef.current = null
      autosaveInFlightRef.current = false
      autosavePendingRef.current = null
    }
  }, [])

  return {
    saveActiveFileNow,
    saveAsActiveFileNow,
  }
}
