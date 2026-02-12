export function buildWireframeMarkdownFromMarkdown(args: { markdown: string; url: string }): string {
  const lines = String(args.markdown || '').split(/\r?\n/)
  const headings: Array<{ level: number; text: string }> = []
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1].length
    const text = String(m[2] || '').trim()
    if (!text) continue
    headings.push({ level, text })
    if (headings.length >= 80) break
  }
  const body = headings.length
    ? headings
        .map(h => `${'  '.repeat(Math.max(0, h.level - 1))}- [H${h.level}] ${h.text}`)
        .join('\n')
    : '- (No headings found)'
  return [`# Wireframe`, '', `URL: ${args.url}`, '', body, ''].join('\n')
}

