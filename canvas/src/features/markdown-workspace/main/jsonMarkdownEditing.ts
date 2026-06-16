import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { hashSignatureParts } from '@/lib/hash/signature'
import { attachMarkdownSourceFidelityPayload } from '@/features/markdown/jsonMarkdownSourceFidelity'

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
  const markdownText = String(args.markdownText || '')
  return JSON.stringify(attachMarkdownSourceFidelityPayload({
    jsonValue: buildMarkdownJsonLd(name, markdownText),
    documentName: name,
    markdownText,
  }), null, 2)
}
