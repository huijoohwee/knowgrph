export const slugify = (text: string): string => {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return normalized || 'x'
}

export const resolveUrl = (baseUrl: string | undefined, value: string): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^(data:|mailto:|tel:|javascript:)/i.test(raw)) return raw
  if (!baseUrl) return raw
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return raw
  }
}

export const coerceMarkdownParenUrl = (raw: string): string => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  const unwrapped =
    trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1).trim() : trimmed
  const firstToken = unwrapped.split(/\s+/)[0] || ''
  return firstToken.trim()
}

export const extractHtmlAttr = (html: string, attr: string): string => {
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, 'i')
  const m = String(html || '').match(re)
  return String(m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim()
}

export const extractMarkdownInlineRefs = (
  text: string,
  options?: { baseUrl?: string },
): { links: Array<{ label: string; url: string }>; images: Array<{ alt: string; url: string }> } => {
  const raw = String(text || '')
  const links: Array<{ label: string; url: string }> = []
  const images: Array<{ alt: string; url: string }> = []
  const baseUrl = options?.baseUrl

  const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g
  imageRe.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = imageRe.exec(raw))) {
    const alt = String(match[1] || '').trim()
    const url = coerceMarkdownParenUrl(match[2] || '')
    if (!url) continue
    images.push({ alt, url: resolveUrl(baseUrl, url) })
  }

  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  linkRe.lastIndex = 0
  while ((match = linkRe.exec(raw))) {
    const idx = typeof match.index === 'number' ? match.index : -1
    if (idx > 0 && raw[idx - 1] === '!') continue
    const label = String(match[1] || '').trim()
    const url = coerceMarkdownParenUrl(match[2] || '')
    if (!url) continue
    links.push({ label, url: resolveUrl(baseUrl, url) })
  }

  const htmlImgRe = /<img\b[^>]*>/gi
  htmlImgRe.lastIndex = 0
  while ((match = htmlImgRe.exec(raw))) {
    const tag = match[0] || ''
    const src = extractHtmlAttr(tag, 'src')
    if (!src) continue
    const url = resolveUrl(baseUrl, src)
    if (!url) continue
    const alt = extractHtmlAttr(tag, 'alt')
    images.push({ alt, url })
  }

  return { links, images }
}

export const classifyMediaFromAltAndUrl = (
  url: string,
  alt: string,
): { type: 'Image' | 'Video' | 'IFrame'; props: Record<string, unknown> } => {
  const altRaw = String(alt || '')
  const altNorm = altRaw.trim().toLowerCase()
  const isVideo = altNorm.startsWith('video') || /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url)
  const isIFrame = altNorm.startsWith('iframe')
  const type: 'Image' | 'Video' | 'IFrame' = isVideo ? 'Video' : isIFrame ? 'IFrame' : 'Image'
  const mediaProps: Record<string, unknown> = {
    url,
    alt,
    media_url: url,
    media: url,
    'visual:shape': 'rect',
  }
  if (type === 'IFrame') {
    mediaProps.media_kind = 'iframe'
    mediaProps.iframe_url = url
  } else if (type === 'Video') {
    mediaProps.media_kind = 'video'
    mediaProps.video = url
  } else {
    mediaProps.media_kind = 'image'
    mediaProps.image = url
  }
  return { type, props: mediaProps }
}
