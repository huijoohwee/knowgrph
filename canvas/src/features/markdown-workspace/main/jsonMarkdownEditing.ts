import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { hashSignatureParts } from '@/lib/hash/signature'

const JSON_MARKDOWN_EDIT_SCOPE = 'markdown-workspace-json-markdown'

export function buildJsonMarkdownSourceSemanticKey(args: {
  activeDocumentKey?: string | null
  text?: string | null
}): string {
  return hashSignatureParts([
    JSON_MARKDOWN_EDIT_SCOPE,
    String(args.activeDocumentKey || '').trim(),
    String(args.text || ''),
  ])
}

export function serializeJsonMarkdownDraftToSourceText(args: {
  activeDocumentKey?: string | null
  editorUri?: string | null
  markdownText: string
}): string {
  const name = String(args.activeDocumentKey || args.editorUri || 'workspace.md').trim() || 'workspace.md'
  return JSON.stringify(buildMarkdownJsonLd(name, String(args.markdownText || '')), null, 2)
}
