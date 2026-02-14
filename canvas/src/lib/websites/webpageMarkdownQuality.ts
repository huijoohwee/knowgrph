export function isLowQualityWebpageMarkdown(markdown: string): boolean {
  const md = String(markdown || '').trim()
  if (!md) return true
  const lines = md.split('\n').map(s => s.trim()).filter(Boolean)
  if (lines.length < 18) return true
  const body = lines[0]?.startsWith('# ') ? lines.slice(1).join('\n').trim() : md
  if (!body) return true
  if (body.length < 1200) return true
  if (md.length < 20_000 && (md.match(/\?/g) || []).length >= 12) return true
  if (/enable\s+javascript/i.test(md)) return true
  return false
}

