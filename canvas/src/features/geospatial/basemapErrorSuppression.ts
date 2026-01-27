export const shouldSuppressBasemapErrorMessage = (message: string): boolean => {
  const trimmed = String(message || '').trim()
  if (!trimmed) return true
  const lower = trimmed.toLowerCase()
  if (lower.includes('map preview unavailable')) return true
  const isLikelyBasemapNoise =
    lower.includes('glyph') ||
    lower.includes('sprite') ||
    lower.includes('tile') ||
    lower.includes('style') ||
    lower.includes('request') ||
    lower.includes('http') ||
    lower.includes('fetch') ||
    lower.includes('cors')
  return isLikelyBasemapNoise
}
