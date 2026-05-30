export function shouldSkipUnifiedMarkdownConversion(html: string): boolean {
  const h = String(html || '')
  if (!h) return false
  if (h.length > 1_500_000) return true
  const scriptCount = (h.match(/<script\b/gi) || []).length
  if (scriptCount > 18) return true
  return false
}
