export function plainTextToMarkdown(text: string, title?: string): string {
  const t = String(text || '').replace(/\r\n/g, '\n').trim()
  const titleText = String(title || '').trim()
  if (!t) return titleText ? `# ${titleText}` : ''
  const chunks = t
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\s*\n\s*/g, ' '))
  const body = chunks.join('\n\n')
  if (!titleText) return body
  const firstLine = (body.split('\n')[0] || '').trim()
  if (firstLine.startsWith('# ')) return body
  return `# ${titleText}\n\n${body}`
}

