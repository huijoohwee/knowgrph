export const normalizeInline = (raw: string) => String(raw || '').replace(/\s+/g, ' ').trim()

export const truncate = (raw: string, max: number) => {
  const s = normalizeInline(raw)
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export const stripTrailingPunctuation = (raw: string) => String(raw || '').replace(/[\s\u00A0]*[.!,:;]+[\s\u00A0]*$/g, '').trim()
