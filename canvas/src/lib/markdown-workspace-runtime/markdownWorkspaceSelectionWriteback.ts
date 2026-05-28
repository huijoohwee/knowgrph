import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'

export type MarkdownWorkspaceSelectionWritebackSync = {
  docKey: string
  markdownName: string
  nextText: string
}

export function resolveMarkdownWorkspaceSelectionWritebackSync(args: {
  activePath?: string | null
  activeDocumentKey: string
  markdownDocumentName: string
  markdownDocumentText: unknown
}): MarkdownWorkspaceSelectionWritebackSync | null {
  const activePath = String(args.activePath || '').trim()
  const docKey = String(args.activeDocumentKey || '').trim()
  const markdownName = String(args.markdownDocumentName || '').trim()
  const nextText = typeof args.markdownDocumentText === 'string' ? args.markdownDocumentText : ''
  if (!docKey || !markdownName || !nextText) return null
  if (activePath && !matchesMarkdownDocumentPath(activePath, markdownName)) return null
  if (!matchesMarkdownDocumentPath(docKey, markdownName)) return null
  return {
    docKey,
    markdownName,
    nextText,
  }
}
