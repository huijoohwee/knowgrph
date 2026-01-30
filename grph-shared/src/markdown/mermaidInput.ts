export const isMermaidCodeFenceLang = (lang: string): boolean => {
  const v = String(lang || '').trim().toLowerCase()
  return v === 'mermaid' || v === 'mmd'
}

export const containsFrontmatterMermaid = (text: string): boolean => {
  const raw = String(text || '')
  if (!raw.trim()) return false
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (!m || !m[1]) return false
  const fm = m[1]
  return /\bmermaid\s*:/i.test(fm)
}

export const normalizeMermaidMmdToMarkdown = (name: string, text: string): string => {
  const fileName = String(name || '').trim().toLowerCase()
  if (!fileName.endsWith('.mmd')) return String(text || '')

  const raw = String(text || '')
  const trimmed = raw.trim()
  if (!trimmed) return raw

  if (/^\s*(```+|~~~+)/m.test(raw)) return raw
  if (/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/.test(raw)) return raw

  return ['```mermaid', trimmed, '```', ''].join('\n')
}

export const isMarkdownLikeFileName = (name: string): boolean => {
  const lower = String(name || '').trim().toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mmd')
}
