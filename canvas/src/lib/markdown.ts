import { load as parseYaml } from 'js-yaml'

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
  let endIndex = -1
  for (let i = 1; i < lines.length; i += 1) {
    if ((lines[i] || '').trim() === '---') {
      endIndex = i
      break
    }
  }
  if (endIndex < 0) return { meta: {}, startIndex: 0 }

  const frontmatterText = lines.slice(1, endIndex).join('\n')
  const sanitizeYamlValue = (value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map(v => sanitizeYamlValue(v))
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(record)) out[key] = sanitizeYamlValue(record[key])
      return out
    }
    return value
  }

  let meta: MarkdownFrontmatter = {}
  try {
    const parsed = parseYaml(frontmatterText) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      meta = sanitizeYamlValue(parsed) as MarkdownFrontmatter
    }
  } catch {
    meta = {}
  }

  return { meta, startIndex: endIndex + 1 }
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

    const fenceOpenMatch = /^(```+|~~~+)\s*(.*)$/.exec(trimmed)
    if (fenceOpenMatch) {
      const marker = fenceOpenMatch[1] || ''
      const info = fenceOpenMatch[2] || ''
      const language = (info.trim().split(/\s+/)[0] || '').trim() || undefined
      const startLine = i + 1
      i += 1
      const bodyLines: string[] = []
      while (i < lineCount) {
        const rawInner = lines[i] ?? ''
        const tInner = rawInner.trim()
        const fenceCloseMatch = /^(```+|~~~+)\s*(.*)$/.exec(tInner)
        if (fenceCloseMatch && fenceCloseMatch[1] === marker) break
        bodyLines.push(rawInner)
        i += 1
      }
      const endLine = Math.min(lineCount, i + 1)
      if (i < lineCount) {
        const maybeClose = (lines[i] ?? '').trim()
        const fenceCloseMatch = /^(```+|~~~+)\s*(.*)$/.exec(maybeClose)
        if (fenceCloseMatch && fenceCloseMatch[1] === marker) {
          i += 1
        }
      }
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
      if (/^(```+|~~~+)/.test(t)) break
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
