export const scoreHtmlContentRootCandidate = (args: {
  tag: string
  id: string
  className: string
  role: string
}): number => {
  const tag = args.tag.toLowerCase()
  const id = args.id.toLowerCase()
  const cls = args.className.toLowerCase()
  const role = args.role.toLowerCase()
  if (id === 'js_content' || /\brich_media_content\b/.test(cls)) return 10_000
  if (tag === 'main' || tag === 'article' || role === 'main') return 1200
  if (id === 'img-content' || id === 'article') return 800
  if (/\b(markdown-body|post-content|entry-content|article-content|article__content|content-body|prose)\b/.test(cls)) return 900
  if (/\barticle\b/.test(cls) && /\bcontent\b/.test(cls)) return 850
  if (/\bcontent\b/.test(cls) && !/\b(nav|menu|footer|header|sidebar|comment|related)\b/.test(cls)) return 500
  return 0
}

export const looksLikePlaceholderMediaSrc = (value: unknown): boolean => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return true
  if (/^about:blank$/i.test(raw)) return true
  if (/^data:image\/gif;base64,R0lGODlhAQABAIAAAAAAAP\/\/\/ywAAAAAAQABAAACAUwAOw==$/i.test(raw)) return true
  if (!/^data:image\/svg\+xml/i.test(raw)) return false
  try {
    const decoded = decodeURIComponent(raw)
    return /width=['"]?1px?['"]?/i.test(decoded) || /height=['"]?1px?['"]?/i.test(decoded) || /viewBox=['"]0 0 1 1['"]/i.test(decoded)
  } catch {
    return true
  }
}

export const shouldPreserveRawHtmlMarkdownLine = (line: string): boolean => {
  const trimmed = String(line || '').trim()
  return /^\s*<[^>]+>/.test(trimmed) || /<[^>]+\s(?:src|href|srcset|data-src|style)=/i.test(line)
}

export const isGenericSvgLabel = (value: string): boolean =>
  /^(插图|图片|image|img|illustration|svg|icon)$/i.test(String(value || '').trim())
