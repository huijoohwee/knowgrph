import React from 'react'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { registerMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { useWorkspaceStatusHelpers } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions'
import type { WorkspaceFileActions } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/types'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { buildMarkdownWorkspaceActionBridge } from './markdownWorkspaceRuntime.composition'

export function useMarkdownWorkspaceShell(args: {
  active: boolean
  refreshWorkspace: () => Promise<unknown>
  highlightedLineRange: unknown
  setHighlightedLineRange: (value: null) => void
  workspaceRootRef: React.MutableRefObject<HTMLElement | null>
  fileActions: WorkspaceFileActions
  createParentPath: WorkspacePath
  saveEnabled: boolean
  saveActiveFileNow: () => Promise<void> | void
}) {
  const {
    active,
    refreshWorkspace,
    highlightedLineRange,
    setHighlightedLineRange,
    workspaceRootRef,
    fileActions,
    createParentPath,
    saveEnabled,
    saveActiveFileNow,
  } = args

  const status = useWorkspaceStatusHelpers()
  const setStatusWithAutoClear = React.useCallback(
    (label: string, ttlMs: number = UI_TOAST_TTL_MS.statusAutoClose) => status.setStatusInfo(label, { ttlMs }),
    [status],
  )

  React.useEffect(() => {
    if (active) void refreshWorkspace()
  }, [active, refreshWorkspace])

  React.useEffect(() => {
    if (!highlightedLineRange) return
    const id = window.setTimeout(() => setHighlightedLineRange(null), 1500)
    return () => window.clearTimeout(id)
  }, [highlightedLineRange, setHighlightedLineRange])

  const toggleFullscreen = React.useCallback(() => {
    const el = workspaceRootRef.current
    if (!el) return
    try {
      const doc = document as Document & { fullscreenElement?: Element | null; exitFullscreen?: () => Promise<void> }
      if (doc.fullscreenElement) {
        void doc.exitFullscreen?.()
        return
      }
      const requestFullscreen = (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
      void requestFullscreen?.call(el)
    } catch {
      void 0
    }
  }, [workspaceRootRef])

  const actionBridge = React.useMemo(
    () =>
      buildMarkdownWorkspaceActionBridge({
        fileActions,
        createParentPath,
        saveEnabled,
        saveActiveFileNow,
      }),
    [createParentPath, fileActions, saveActiveFileNow, saveEnabled],
  )

  React.useEffect(() => {
    return registerMarkdownWorkspaceActionBridge('markdown-workspace-explorer', actionBridge)
  }, [actionBridge])

  return {
    status,
    setStatusWithAutoClear,
    toggleFullscreen,
  }
}
