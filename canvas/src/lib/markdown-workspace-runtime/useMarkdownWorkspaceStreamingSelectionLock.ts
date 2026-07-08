import React from 'react'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { useGraphStore } from '@/hooks/useGraphStore'
import { shouldRejectMarkdownDocumentPayload } from '@/lib/markdown/markdownDocumentPayloadGuards'
import { normalizeMarkdownWorkspaceSelectionPath } from './markdownWorkspaceSelectionPath'

export function resolveStreamingWorkspaceSelectionLockTarget(args: {
  activePath: WorkspacePath | null
  streamingPath: WorkspacePath | null
  streamingText: string | null | undefined
}): WorkspacePath | null {
  const text = String(args.streamingText || '')
  if (!text || shouldRejectMarkdownDocumentPayload(text)) return null
  const targetPath = normalizeMarkdownWorkspaceSelectionPath(args.streamingPath)
  if (!targetPath) return null
  const activePath = normalizeMarkdownWorkspaceSelectionPath(args.activePath)
  if (activePath) return null
  return targetPath
}

export function useMarkdownWorkspaceStreamingSelectionLock(args: {
  activePath: WorkspacePath | null
  setActivePathSafe: (path: WorkspacePath) => void
  setSelectionPathSafe: (path: WorkspacePath) => void
}) {
  const { activePath, setActivePathSafe, setSelectionPathSafe } = args
  const streamingPath = useGraphStore(s => s.chatWorkspaceStreamingPath || null)
  const streamingText = useGraphStore(s => s.chatWorkspaceStreamingText || null)
  const lockTarget = resolveStreamingWorkspaceSelectionLockTarget({
    activePath,
    streamingPath,
    streamingText,
  })

  React.useEffect(() => {
    if (!lockTarget) return
    if (normalizeMarkdownWorkspaceSelectionPath(useMarkdownExplorerStore.getState().activePath)) return
    setActivePathSafe(lockTarget)
    setSelectionPathSafe(lockTarget)
  }, [lockTarget, setActivePathSafe, setSelectionPathSafe])
}
