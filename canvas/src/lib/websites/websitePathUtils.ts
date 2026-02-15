export const safeWebsitePathSegment = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return 'item'
  const cleaned = s
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .replace(/[-.]+$/, '')
  return cleaned.slice(0, 64) || 'item'
}

export const hostFromUrl = (url: string): string => {
  try {
    return new URL(String(url || '')).host
  } catch {
    return ''
  }
}

