type SanitizeResult = { text: string; changed: boolean }

const decodeHtmlEntitiesBasic = (text: string): string => {
  const src = String(text || '')
  if (!src.includes('&')) return src
  return src
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
}

const markdownEscape = (text: string): string =>
  decodeHtmlEntitiesBasic(String(text || ''))
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[[\]\\]/g, '\\$&')
    .trim()

const readHtmlAttr = (tag: string, names: string[]): string => {
  const source = String(tag || '')
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + '`' + `]+))`, 'i')
    const m = source.match(re)
    const value = String(m?.[1] || m?.[2] || m?.[3] || '').trim()
    if (value) return decodeHtmlEntitiesBasic(value)
  }
  return ''
}

const normalizeText = (html: string): string => {
  let next = String(html || '')
  next = next.replace(/<!--[\s\S]*?-->/g, ' ')
  next = next.replace(/<\s*(script|style)\b[\s\S]*?<\/\s*\1\s*>/gi, ' ')
  next = next.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  next = next.replace(/<\/\s*(p|div|section|article|header|footer|li|h[1-6])\s*>/gi, '\n')
  next = next.replace(/<\s*(p|div|section|article|header|footer|li|h[1-6])\b[^>]*>/gi, '\n')
  next = decodeHtmlEntitiesBasic(next.replace(/<[^>]+>/g, ' '))
  return next
    .split(/\r?\n/g)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

const isMostlyDecorativeText = (text: string): boolean => {
  const compact = String(text || '').replace(/\s+/g, '')
  if (!compact) return true
  if (/^[•·・*※—\-_=|/\\]+$/.test(compact)) return true
  return false
}

const pushLines = (out: string[], value: string) => {
  const lines = String(value || '')
    .split(/\r?\n/g)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line && !isMostlyDecorativeText(line))
  for (const line of lines) {
    if (out[out.length - 1] !== line) out.push(line)
  }
}

const htmlTokenToMarkdown = (token: string): string => {
  const raw = String(token || '')
  const lower = raw.toLowerCase()
  if (/^<\s*img\b/i.test(raw)) {
    const src = readHtmlAttr(raw, ['data-src', 'data-original-src', 'data-original', 'src'])
    if (!src || /^data:image\/(?:gif|svg\+xml)/i.test(src)) return ''
    const alt = markdownEscape(readHtmlAttr(raw, ['alt', 'title']))
    return `![${alt}](${src})`
  }

  if (/^<\s*a\b/i.test(raw)) {
    const href = readHtmlAttr(raw, ['href'])
    const text = normalizeText(raw).replace(/\s+/g, ' ').trim()
    if (!text) return ''
    if (!href || /^javascript:/i.test(href)) return text
    return `[${markdownEscape(text)}](${href})`
  }

  const text = normalizeText(raw).replace(/\s+/g, ' ').trim()
  if (!text || isMostlyDecorativeText(text)) return ''
  const headingMatch = raw.match(/^<\s*h([1-6])\b/i)
  if (headingMatch) {
    const depth = Math.min(6, Math.max(1, Number(headingMatch[1]) || 2))
    return `${'#'.repeat(depth)} ${text}`
  }
  const strongOnly =
    /<\s*(strong|b)\b/i.test(lower) &&
    !/<\s*(img|a|table|ul|ol|video|audio|iframe)\b/i.test(lower) &&
    text.length <= 48
  return strongOnly ? `## ${text}` : text
}

const layoutHtmlBlockToMarkdown = (block: string): string => {
  const html = String(block || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*(script|style)\b[\s\S]*?<\/\s*\1\s*>/gi, ' ')
  const tokenRe = /<\s*img\b[^>]*>|<\s*a\b[^>]*>[\s\S]*?<\/\s*a\s*>|<\s*h([1-6])\b[^>]*>[\s\S]*?<\/\s*h\1\s*>|<\s*p\b[^>]*>[\s\S]*?<\/\s*p\s*>/gi
  const out: string[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(html))) {
    pushLines(out, normalizeText(html.slice(last, match.index)))
    const token = htmlTokenToMarkdown(match[0] || '')
    pushLines(out, token)
    last = match.index + match[0].length
  }
  pushLines(out, normalizeText(html.slice(last)))
  return out.join('\n').trim()
}

const countTagMatches = (source: string, tag: string, closing: boolean): number => {
  const slash = closing ? '\\/\\s*' : ''
  const re = new RegExp(`<\\s*${slash}${tag}\\b`, 'gi')
  const matches = String(source || '').match(re)
  return matches ? matches.length : 0
}

export const normalizeStandaloneHtmlLayoutBlocksToMarkdown = (text: string): SanitizeResult => {
  const raw = String(text || '')
  if (!/<(?:section|article)\b/i.test(raw)) return { text: raw, changed: false }

  const lines = raw.split(/\r?\n/g)
  let inFence = false
  let fence = ''
  let changed = false
  const out: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    const mFence = trimmed.match(/^(```+|~~~+)(.*)$/)
    if (mFence) {
      if (!inFence) {
        inFence = true
        fence = mFence[1] || '```'
      } else if (trimmed.startsWith(fence)) {
        inFence = false
        fence = ''
      }
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    const startMatch = trimmed.match(/^<(section|article)\b/i)
    if (!startMatch) {
      out.push(line)
      continue
    }

    const rootTag = String(startMatch[1] || '').toLowerCase()
    let end = i
    let depth = countTagMatches(line, rootTag, false) - countTagMatches(line, rootTag, true)
    while (depth > 0 && end + 1 < lines.length && end - i < 240) {
      end += 1
      const nextLine = String(lines[end] || '')
      depth += countTagMatches(nextLine, rootTag, false)
      depth -= countTagMatches(nextLine, rootTag, true)
    }
    if (depth > 0) {
      out.push(line)
      continue
    }

    const block = lines.slice(i, end + 1).join('\n')
    const next = layoutHtmlBlockToMarkdown(block)
    if (next) out.push(next)
    changed = true
    i = end
  }

  return { text: changed ? out.join('\n') : raw, changed }
}
