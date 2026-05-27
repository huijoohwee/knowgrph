import type { WorkspacePath } from '@/features/workspace-fs/types'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'

export function isMarkdownWorkspaceDocumentSwitchPending(args: {
  activePath: WorkspacePath | null | undefined
  markdownDocumentName: string | null | undefined
}): boolean {
  const activePath = String(args.activePath || '').trim()
  if (!activePath) return false
  const markdownDocumentName = String(args.markdownDocumentName || '').trim()
  if (!markdownDocumentName) return true
  return !matchesMarkdownDocumentPath(activePath, markdownDocumentName)
}
