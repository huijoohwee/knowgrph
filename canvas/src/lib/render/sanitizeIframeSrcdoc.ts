export function sanitizeIframeSrcdoc(rawSrcDoc: string): string {
  let s = String(rawSrcDoc || '')
  if (!s.trim()) return ''
  s = s.replace(/<\s*script\b[\s\S]*?<\/\s*script\s*>/gi, '')
  s = s.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  s = s.replace(/\bjavascript\s*:/gi, '')
  return s.trim()
}
