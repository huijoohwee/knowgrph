export function tailwindTextSizeClassToPx(textSizeClass: string | null | undefined): number | null {
  const raw = typeof textSizeClass === 'string' ? textSizeClass : ''
  if (!raw.trim()) return null

  const token = raw
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .find(t => t.startsWith('text-'))

  if (!token) return null

  const explicitPxMatch = token.match(/^text-\[(\d+(?:\.\d+)?)px\]$/)
  if (explicitPxMatch) {
    const n = Number(explicitPxMatch[1])
    return Number.isFinite(n) ? n : null
  }

  switch (token) {
    case 'text-[9px]':
      return 9
    case 'text-[10px]':
      return 10
    case 'text-[11px]':
      return 11
    case 'text-xs':
      return 12
    case 'text-sm':
      return 14
    case 'text-base':
      return 16
    case 'text-lg':
      return 18
    case 'text-xl':
      return 20
    default:
      return null
  }
}

