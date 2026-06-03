import type { WorkspacePath } from '@/features/workspace-fs/types'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
import { isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'

export function isMarkdownWorkspaceDocumentSwitchPending(args: {
  activePath: WorkspacePath | null | undefined
  markdownDocumentName: string | null | undefined
  ownerActive?: boolean | null | undefined
}): boolean {
  if (args.ownerActive === false) return false
  const activePath = String(args.activePath || '').trim()
  if (!activePath) return false
  if (!isMarkdownLikeFileName(activePath)) return false
  const markdownDocumentName = String(args.markdownDocumentName || '').trim()
  if (!markdownDocumentName) return true
  return !matchesMarkdownDocumentPath(activePath, markdownDocumentName)
}
