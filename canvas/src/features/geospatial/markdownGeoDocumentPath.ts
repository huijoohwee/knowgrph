import { normalizeComposedSourcePath } from '@/features/source-files/composedSourceSelection'

const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const WORKSPACE_SCHEME_RE = /^workspace:\/*/i

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

const splitDocumentFragment = (value: string): { base: string; fragment: string } => {
  const text = String(value || '').trim()
  const index = text.indexOf('#')
  if (index < 0) return { base: text, fragment: '' }
  return {
    base: text.slice(0, index),
    fragment: text.slice(index + 1),
  }
}

export function normalizeMarkdownGeoSourceDocumentPath(raw: unknown): string {
  const text = String(raw || '').trim().replace(/\\/g, '/')
  if (!text) return ''

  const { base } = splitDocumentFragment(text)
  const trimmedBase = trimTrailingSlashes(base.trim())
  if (!trimmedBase) return ''

  if (URI_SCHEME_RE.test(trimmedBase) && !WORKSPACE_SCHEME_RE.test(trimmedBase)) {
    return trimmedBase
  }
  return normalizeComposedSourcePath(trimmedBase)
}

export function readMarkdownGeoSourceDocumentBasename(raw: unknown): string {
  const normalized = normalizeMarkdownGeoSourceDocumentPath(raw)
  if (!normalized) return ''
  if (URI_SCHEME_RE.test(normalized) && !WORKSPACE_SCHEME_RE.test(normalized)) {
    try {
      const url = new URL(normalized)
      const pathname = trimTrailingSlashes(url.pathname || '')
      const parts = pathname.split('/').filter(Boolean)
      return parts[parts.length - 1] || ''
    } catch {
      const noHash = normalized.split('#')[0] || ''
      const parts = noHash.split('/').filter(Boolean)
      return parts[parts.length - 1] || ''
    }
  }
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}
