export const containsFrontmatterMermaid = (text: string): boolean => {
  const raw = String(text || '')
  if (!raw.trim()) return false
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)
  if (!m || !m[1]) return false
  const fm = m[1]
  return /\bmermaid\s*:/i.test(fm)
}

