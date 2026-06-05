import { looksLikeViteDevIndexHtml } from '@/lib/config'

export function shouldRejectMarkdownDocumentPayload(value: unknown): boolean {
  const text = typeof value === 'string' ? value : ''
  if (!text.trim()) return false
  return looksLikeViteDevIndexHtml(text)
}
