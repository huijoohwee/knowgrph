export const sanitizeInvalidDataUrls = (raw: string): string => {
  const s = String(raw || '')
  if (!s) return s
  return s.replace(/\bdata:(?!image\/|video\/|audio\/|application\/pdf)[^\s)\]"']+/gi, 'data:')
}

