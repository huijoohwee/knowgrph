export type FencedCodeBlock = {
  lang: string
  info: string
  content: string
  startLine: number
  endLine: number
}

export function extractFencedCodeBlocks(text: string): FencedCodeBlock[] {
  const lines = String(text || '').split(/\r\n|\n|\r/)
  const blocks: FencedCodeBlock[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const open = line.match(/^\s*(`{3,}|~{3,})\s*([^\s`]*)\s*(.*)$/)
    if (!open) {
      i += 1
      continue
    }

    const fence = open[1] ?? '```'
    const lang = String(open[2] || '').trim().toLowerCase()
    const info = String(open[3] || '').trim()
    const startLine = i + 1

    const contentLines: string[] = []
    i += 1
    while (i < lines.length) {
      const closeLine = lines[i] ?? ''
      const close = closeLine.match(new RegExp(`^\\s*${fence.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*$`))
      if (close) break
      contentLines.push(closeLine)
      i += 1
    }

    const endLine = Math.min(i + 1, lines.length)
    blocks.push({ lang, info, content: contentLines.join('\n'), startLine, endLine })

    while (i < lines.length) {
      const closeLine = lines[i] ?? ''
      const close = closeLine.match(new RegExp(`^\\s*${fence.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*$`))
      if (close) {
        i += 1
        break
      }
      i += 1
    }
  }

  return blocks
}

