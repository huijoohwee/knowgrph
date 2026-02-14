export type HSection = { level: number; title: string; body: string }

export const normalizeInline = (raw: string) => String(raw || '').replace(/\s+/g, ' ').trim()

export const truncate = (raw: string, max: number) => {
  const s = normalizeInline(raw)
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export const stripTrailingPunctuation = (raw: string) => String(raw || '').replace(/[\s\u00A0]*[\.!,:;]+[\s\u00A0]*$/g, '').trim()

export const stripWww = (rawHost: string) =>
  String(rawHost || '').toLowerCase().startsWith('www.') ? String(rawHost || '').slice(4) : String(rawHost || '')

export const stripFrontmatter = (markdown: string): string => {
  const s = String(markdown || '')
  if (!s.startsWith('---')) return s
  const lines = s.split(/\r?\n/)
  if (lines.length < 3) return s
  if (String(lines[0] || '').trim() !== '---') return s
  const endIdx = lines.slice(1).findIndex(l => String(l || '').trim() === '---')
  if (endIdx < 0) return s
  return lines.slice(endIdx + 2).join('\n')
}

export const extractHeadings = (markdown: string, max: number): Array<{ level: number; title: string }> => {
  const out: Array<{ level: number; title: string }> = []
  for (const line of stripFrontmatter(markdown).split(/\r?\n/)) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1]?.length || 0
    const title = normalizeInline(m[2] || '')
    if (!title) continue
    out.push({ level, title })
    if (out.length >= max) break
  }
  return out
}

export const extractHSections = (markdown: string, maxSections: number): HSection[] => {
  const lines = stripFrontmatter(markdown).split(/\r?\n/)
  const out: HSection[] = []
  let current: HSection | null = null

  const flush = () => {
    if (!current) return
    const body = current.body.trimEnd()
    out.push({ level: current.level, title: current.title, body })
  }

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (m) {
      if (current) flush()
      const level = m[1]?.length || 0
      const title = normalizeInline(m[2] || '')
      current = { level, title, body: '' }
      if (out.length >= maxSections) break
      continue
    }
    if (!current) continue
    current.body += `${line}\n`
  }
  if (current && out.length < maxSections) flush()
  return out
}

export const countMatches = (re: RegExp, text: string) => {
  const m = String(text || '').match(re)
  return m ? m.length : 0
}

export type MarkdownLink = { text: string; href: string }

export const extractMarkdownLinks = (markdown: string, max: number): MarkdownLink[] => {
  const out: MarkdownLink[] = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  for (const line of String(markdown || '').split(/\r?\n/)) {
    re.lastIndex = 0
    while ((m = re.exec(line))) {
      const idx = m.index
      if (idx > 0 && line.charCodeAt(idx - 1) === 33) continue
      const text = stripTrailingPunctuation(normalizeInline(m[1] || ''))
      const href = normalizeInline(m[2] || '')
      if (!text || !href) continue
      if (out.some(x => x.text.toLowerCase() === text.toLowerCase() && x.href === href)) continue
      out.push({ text, href })
      if (out.length >= max) return out
    }
  }
  return out
}

export const extractMarkdownLinkTexts = (markdown: string, max: number): string[] => {
  const out: string[] = []
  for (const l of extractMarkdownLinks(markdown, Math.max(1, max * 2))) {
    const t = l.text
    if (!t) continue
    if (out.some(x => x.toLowerCase() === t.toLowerCase())) continue
    out.push(t)
    if (out.length >= max) return out
  }
  return out
}

export const countUniqueMarkdownLinkTexts = (markdown: string) => extractMarkdownLinkTexts(markdown, 2000).length

export const countSectionParagraphs = (markdown: string) => {
  const lines = String(markdown || '').split(/\r?\n/)
  let inFence = false
  let count = 0
  let pending = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      pending = false
      continue
    }
    if (inFence) continue
    if (!trimmed) {
      pending = false
      continue
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      pending = false
      continue
    }
    if (/^>\s+/.test(trimmed)) {
      pending = false
      continue
    }
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      pending = false
      continue
    }
    const linkCount = countMatches(/\[[^\]]+\]\([^)]+\)/g, line)
    if (linkCount >= 2) {
      pending = false
      continue
    }
    if (!pending && trimmed.length >= 12) {
      count += 1
      pending = true
    }
  }
  return count
}

export const inferPageOverviewSentence = (markdown: string, maxLen: number) => {
  const body = stripFrontmatter(markdown)
  const lines = body.split(/\r?\n/)
  for (const line of lines) {
    const t = normalizeInline(line)
    if (!t) continue
    if (/^#{1,6}\s+/.test(t)) continue
    if (/^\[/.test(t) && /\]\(/.test(t)) continue
    if (t.startsWith('$ ')) continue
    return truncate(t, maxLen)
  }
  return ''
}

export const findFirstInlineCommand = (markdown: string) => {
  for (const line of stripFrontmatter(markdown).split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith('$ ')) return truncate(t, 52)
  }
  return ''
}

export const extractMarkdownTableUnderH2 = (markdown: string, h2Title: string): string => {
  const titleNeedle = normalizeInline(h2Title).toLowerCase()
  const lines = stripFrontmatter(markdown).split(/\r?\n/)
  const startIdx = lines.findIndex((l) => {
    const m = String(l || '').match(/^##\s+(.+?)\s*$/)
    return m ? normalizeInline(m[1] || '').toLowerCase() === titleNeedle : false
  })
  if (startIdx < 0) return ''
  const bodyLines: string[] = []
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (/^##\s+/.test(line)) break
    bodyLines.push(line)
  }
  const start = bodyLines.findIndex(l => String(l || '').trim().startsWith('|'))
  if (start < 0) return ''
  const out: string[] = []
  for (let i = start; i < bodyLines.length; i += 1) {
    const line = String(bodyLines[i] || '').trimEnd()
    if (!line.trim()) break
    if (!line.trim().startsWith('|')) break
    out.push(line)
  }
  return out.join('\n').trimEnd()
}

export const extractBlockUnderH2 = (markdown: string, h2Title: string, maxLines: number): string => {
  const titleNeedle = normalizeInline(h2Title).toLowerCase()
  const lines = stripFrontmatter(markdown).split(/\r?\n/)
  const startIdx = lines.findIndex((l) => {
    const m = String(l || '').match(/^##\s+(.+?)\s*$/)
    return m ? normalizeInline(m[1] || '').toLowerCase() === titleNeedle : false
  })
  if (startIdx < 0) return ''
  const bodyLines: string[] = []
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (/^##\s+/.test(line)) break
    bodyLines.push(line)
    if (bodyLines.length >= maxLines) break
  }
  return bodyLines.join('\n').trimEnd()
}

export const parseExtractedNavMenus = (markdown: string): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  const block = extractBlockUnderH2(markdown, 'Extracted Navigation Menus', 48)
  if (!block) return out
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*+]\s*([^:]+):\s*(.+?)\s*$/)
    if (!m) continue
    const key = normalizeInline(m[1] || '')
    const items = String(m[2] || '')
      .split('|')
      .map(x => stripTrailingPunctuation(normalizeInline(x)))
      .filter(Boolean)
    if (!key) continue
    out[key] = items
  }
  return out
}

export const extractTemplates = (markdown: string): string[] => {
  const sections = extractHSections(markdown, 200)
  const templatesSection = sections.find(s => s.level === 2 && normalizeInline(s.title).toLowerCase() === 'templates')
  const fromBody = templatesSection ? extractMarkdownLinkTexts(templatesSection.body, 12) : []
  const cleaned = (fromBody.length ? fromBody : [])
    .map(t => stripTrailingPunctuation(normalizeInline(t)))
    .filter(Boolean)
    .map(t => (/^find\s+a\s+template$/i.test(t) ? 'Find a template →' : t))
  if (cleaned.length) return cleaned
  const extracted = extractBlockUnderH2(markdown, 'Templates', 40)
  if (!extracted) return []
  const items = extracted
    .split(/\r?\n/)
    .map(l => {
      const m = l.match(/^\s*[-*+]\s*(.+?)\s*$/)
      return m ? stripTrailingPunctuation(normalizeInline(m[1] || '')) : ''
    })
    .filter(Boolean)
    .map(t => (/^find\s+a\s+template$/i.test(t) ? 'Find a template →' : t))
  return items.slice(0, 12)
}
