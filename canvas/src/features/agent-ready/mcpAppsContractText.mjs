export const normalizeString = (value) => String(value || '').trim()

export const escapeHtml = (value) => normalizeString(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

export const safeJsonForInlineScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

export const readUrlOrigin = (value) => {
  const source = normalizeString(value)
  if (!source) return ''
  try {
    return new URL(source).origin
  } catch {
    return ''
  }
}
