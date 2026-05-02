import type { MutableRefObject } from 'react'
import type { WorkspacePath } from '@/features/workspace-fs/types'

export function commitMarkdownWorkspaceWriteback(args: {
  path: WorkspacePath
  text: string
  lastLoadedRef: MutableRefObject<{ path: WorkspacePath; text: string } | null>
  patchWorkspaceEntryInlineText: (path: WorkspacePath, text: string) => void
  setActiveTextProgrammatic: (next: string) => void
}): void {
  args.lastLoadedRef.current = { path: args.path, text: args.text }
  args.patchWorkspaceEntryInlineText(args.path, args.text)
  args.setActiveTextProgrammatic(args.text)
}
