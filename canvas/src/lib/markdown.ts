export type MarkdownFrontmatter = Record<string, unknown>

export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string; startLine: number; endLine: number }
  | { kind: 'paragraph'; text: string; startLine: number; endLine: number }
  | { kind: 'code'; text: string; language?: string; startLine: number; endLine: number }
  | { kind: 'table'; text: string; startLine: number; endLine: number }
  | {
      kind: 'list'
      items: Array<{ text: string; ordered: boolean; index?: number }>
      startLine: number
      endLine: number
    }

export const splitMarkdownLines = (raw: string): string[] =>
  String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')

export const parseMarkdownFrontmatter = (
  lines: string[],
): { meta: MarkdownFrontmatter; startIndex: number } => {
  if (!lines.length) return { meta: {}, startIndex: 0 }
  if ((lines[0] || '').trim() !== '---') return { meta: {}, startIndex: 0 }
  const meta: MarkdownFrontmatter = {}
  const structuredKeys = new Set(['ontologies', 'polygonLayers'])
  let currentKey: string | null = null
  let currentList: unknown[] = []
  let currentIndent = 0

  const finalizeList = () => {
    if (currentKey && currentList.length) {
      meta[currentKey] = currentList
    }
    currentKey = null
    currentList = []
    currentIndent = 0
  }

  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? ''
    const trimmed = rawLine.trim()
    if (trimmed === '---') {
      finalizeList()
      return { meta, startIndex: i + 1 }
    }
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = rawLine.length - trimmed.length
    const isDashItem = trimmed.startsWith('- ')
    const colonIndex = trimmed.indexOf(':')

    if (currentKey && structuredKeys.has(currentKey)) {
      if (isDashItem && indent > currentIndent) {
        const afterDash = trimmed.slice(2).trim()
        if (!afterDash) continue
        if (currentKey === 'ontologies') {
          const innerIdx = afterDash.indexOf(':')
          if (innerIdx > 0) {
            const field = afterDash.slice(0, innerIdx).trim()
            const value = afterDash.slice(innerIdx + 1).trim()
            if (field) {
              const obj: Record<string, unknown> = {}
              obj[field] = value
              currentList.push(obj)
            }
          }
        } else if (currentKey === 'polygonLayers') {
          currentList.push(afterDash)
        }
        continue
      }

      if (!isDashItem && colonIndex > 0 && indent > currentIndent) {
        const fieldKey = trimmed.slice(0, colonIndex).trim()
        const fieldVal = trimmed.slice(colonIndex + 1).trim()
        if (!fieldKey) continue
        if (currentKey === 'ontologies') {
          const last = currentList[currentList.length - 1]
          if (last && typeof last === 'object' && !Array.isArray(last)) {
            ;(last as Record<string, unknown>)[fieldKey] = fieldVal
          } else {
            const obj: Record<string, unknown> = {}
            obj[fieldKey] = fieldVal
            currentList.push(obj)
          }
        } else if (currentKey === 'polygonLayers') {
          currentList.push(fieldVal || fieldKey)
        }
        continue
      }
    }

    if (colonIndex > 0 && !isDashItem) {
      finalizeList()
      const key = trimmed.slice(0, colonIndex).trim()
      const val = trimmed.slice(colonIndex + 1).trim()
      if (!key) continue
      if (structuredKeys.has(key)) {
        currentKey = key
        currentIndent = indent
        currentList = []
        if (val) {
          if (key === 'ontologies') {
            const innerIdx = val.indexOf(':')
            if (innerIdx > 0) {
              const field = val.slice(0, innerIdx).trim()
              const value = val.slice(innerIdx + 1).trim()
              if (field) {
                const obj: Record<string, unknown> = {}
                obj[field] = value
                currentList.push(obj)
              }
            }
          } else if (key === 'polygonLayers') {
            currentList.push(val)
          }
        }
      } else {
        meta[key] = val
      }
      continue
    }
  }

  finalizeList()
  return { meta: {}, startIndex: 0 }
}

export const parseMarkdownBlocks = (lines: string[], startIndex: number): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = []
  let i = startIndex
  const lineCount = lines.length
  while (i < lineCount) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    if (!trimmed) {
      i += 1
      continue
    }

    const fenceMatch = /^```([\w-]+)?\s*$/.exec(trimmed)
    if (fenceMatch) {
      const language = (fenceMatch[1] || '').trim() || undefined
      const startLine = i + 1
      i += 1
      const bodyLines: string[] = []
      while (i < lineCount) {
        const t = (lines[i] ?? '').trim()
        if (t === '```') break
        bodyLines.push(lines[i] ?? '')
        i += 1
      }
      const endLine = Math.min(lineCount, i + 1)
      if (i < lineCount && (lines[i] ?? '').trim() === '```') i += 1
      blocks.push({ kind: 'code', text: bodyLines.join('\n'), language, startLine, endLine })
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (headingMatch) {
      const level = headingMatch[1]?.length || 1
      const text = String(headingMatch[2] || '').trim()
      const lineNo = i + 1
      blocks.push({ kind: 'heading', level, text, startLine: lineNo, endLine: lineNo })
      i += 1
      continue
    }

    const listMatch = /^(\s*)([-*+]|(\d+)\.)\s+(.+)$/.exec(line)
    if (listMatch) {
      const indent = listMatch[1] || ''
      const startLine = i + 1
      const items: Array<{ text: string; ordered: boolean; index?: number }> = []
      while (i < lineCount) {
        const liLine = lines[i] ?? ''
        const m = /^(\s*)([-*+]|(\d+)\.)\s+(.+)$/.exec(liLine)
        if (!m) break
        if ((m[1] || '') !== indent) break
        const ordered = !!m[3]
        const index = ordered ? Number(m[3] || '') : undefined
        const text = String(m[4] || '').trim()
        items.push({
          text,
          ordered,
          index: Number.isFinite(index as number) ? (index as number) : undefined,
        })
        i += 1
        while (i < lineCount) {
          const cont = lines[i] ?? ''
          if (!cont.trim()) break
          const contListStart = /^(\s*)([-*+]|(\d+)\.)\s+/.test(cont)
          const contIndent = /^(\s+)/.exec(cont)?.[1] || ''
          if (contListStart || contIndent.length <= indent.length) break
          const last = items[items.length - 1]
          last.text = `${last.text}\n${cont.trim()}`
          i += 1
        }
        while (i < lineCount && !(lines[i] ?? '').trim()) {
          i += 1
        }
      }
      const endLine = Math.max(startLine, i)
      blocks.push({ kind: 'list', items, startLine, endLine })
      continue
    }

    const isTableDivider = (raw: string): boolean => {
      const t = (raw || '').trim()
      if (!t) return false
      if (!t.includes('|')) return false
      return /^(\|?\s*:?-+:?\s*)+\|?\s*$/.test(t.replace(/\|/g, '| '))
    }

    if (trimmed.includes('|') && i + 1 < lineCount && isTableDivider(lines[i + 1] ?? '')) {
      const startLine = i + 1
      const tableLines: string[] = []
      while (i < lineCount) {
        const t = (lines[i] ?? '').trim()
        if (!t) break
        if (!t.includes('|')) break
        tableLines.push(lines[i] ?? '')
        i += 1
      }
      const endLine = Math.max(startLine, i)
      blocks.push({ kind: 'table', text: tableLines.join('\n'), startLine, endLine })
      continue
    }

    const startLine = i + 1
    const paraLines: string[] = []
    while (i < lineCount) {
      const raw = lines[i] ?? ''
      const t = raw.trim()
      if (!t) break
      if (/^```/.test(t)) break
      if (/^(#{1,6})\s+/.test(t)) break
      if (/^(\s*)([-*+]|(\d+)\.)\s+/.test(raw)) break
      if (t.includes('|') && i + 1 < lineCount && isTableDivider(lines[i + 1] ?? '')) break
      paraLines.push(raw)
      i += 1
    }
    const endLine = Math.max(startLine, i)
    blocks.push({
      kind: 'paragraph',
      text: paraLines.join('\n').trim(),
      startLine,
      endLine,
    })
  }
  return blocks
}
