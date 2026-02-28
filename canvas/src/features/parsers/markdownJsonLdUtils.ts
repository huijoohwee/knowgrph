import { isLikelyImageUrl } from '@/lib/url'

export { slugify } from 'grph-shared/markdown/slugify'

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
  const seenMedia = new Set<string>()

  const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g
  imageRe.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = imageRe.exec(raw))) {
    const alt = String(match[1] || '').trim()
    const url = coerceMarkdownParenUrl(match[2] || '')
    if (!url) continue
    const resolved = resolveUrl(baseUrl, url)
    const key = `mdimg:${resolved}`
    if (!seenMedia.has(key)) {
      seenMedia.add(key)
      images.push({ alt, url: resolved })
    }
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
    const key = `img:${url}`
    if (!seenMedia.has(key)) {
      seenMedia.add(key)
      images.push({ alt, url })
    }
  }

  const htmlIframeRe = /<iframe\b[^>]*>/gi
  htmlIframeRe.lastIndex = 0
  while ((match = htmlIframeRe.exec(raw))) {
    const tag = match[0] || ''
    const src = extractHtmlAttr(tag, 'src') || extractHtmlAttr(tag, 'data-src')
    if (!src) continue
    const url = resolveUrl(baseUrl, src)
    if (!url) continue
    const key = `iframe:${url}`
    if (!seenMedia.has(key)) {
      seenMedia.add(key)
      images.push({ alt: 'iframe', url })
    }
  }

  const htmlVideoRe = /<video\b[^>]*>[\s\S]*?<\/video\s*>/gi
  htmlVideoRe.lastIndex = 0
  while ((match = htmlVideoRe.exec(raw))) {
    const block = match[0] || ''
    const open = block.match(/<video\b[^>]*>/i)?.[0] || block
    const src = extractHtmlAttr(open, 'src') || extractHtmlAttr(open, 'data-src')
    if (src) {
      const url = resolveUrl(baseUrl, src)
      if (url) {
        const key = `video:${url}`
        if (!seenMedia.has(key)) {
          seenMedia.add(key)
          images.push({ alt: 'video', url })
        }
        continue
      }
    }
    const sourceRe = /<source\b[^>]*>/gi
    sourceRe.lastIndex = 0
    let sm: RegExpExecArray | null
    while ((sm = sourceRe.exec(block))) {
      const sourceTag = sm[0] || ''
      const src2 = extractHtmlAttr(sourceTag, 'src') || extractHtmlAttr(sourceTag, 'data-src')
      if (!src2) continue
      const url2 = resolveUrl(baseUrl, src2)
      if (!url2) continue
      const key2 = `video:${url2}`
      if (seenMedia.has(key2)) continue
      seenMedia.add(key2)
      images.push({ alt: 'video', url: url2 })
      break
    }
  }

  const htmlAudioRe = /<audio\b[^>]*>[\s\S]*?<\/audio\s*>/gi
  htmlAudioRe.lastIndex = 0
  while ((match = htmlAudioRe.exec(raw))) {
    const block = match[0] || ''
    const open = block.match(/<audio\b[^>]*>/i)?.[0] || block
    const src = extractHtmlAttr(open, 'src') || extractHtmlAttr(open, 'data-src')
    if (src) {
      const url = resolveUrl(baseUrl, src)
      if (url) {
        const key = `audio:${url}`
        if (!seenMedia.has(key)) {
          seenMedia.add(key)
          images.push({ alt: 'audio', url })
        }
        continue
      }
    }
    const sourceRe = /<source\b[^>]*>/gi
    sourceRe.lastIndex = 0
    let sm: RegExpExecArray | null
    while ((sm = sourceRe.exec(block))) {
      const sourceTag = sm[0] || ''
      const src2 = extractHtmlAttr(sourceTag, 'src') || extractHtmlAttr(sourceTag, 'data-src')
      if (!src2) continue
      const url2 = resolveUrl(baseUrl, src2)
      if (!url2) continue
      const key2 = `audio:${url2}`
      if (seenMedia.has(key2)) continue
      seenMedia.add(key2)
      images.push({ alt: 'audio', url: url2 })
      break
    }
  }

  const autoImgAngleRe = /<\s*(https?:\/\/[^>\s]+)\s*>/gi
  autoImgAngleRe.lastIndex = 0
  while ((match = autoImgAngleRe.exec(raw))) {
    const url = String(match[1] || '').trim()
    if (!url) continue
    const resolved = resolveUrl(baseUrl, url)
    if (!resolved) continue
    if (!isLikelyImageUrl(resolved)) continue
    const key = `autoimg:${resolved}`
    if (seenMedia.has(key)) continue
    seenMedia.add(key)
    images.push({ alt: '', url: resolved })
  }

  const autoImgBareRe = /\bhttps?:\/\/[^\s<>()]+/gi
  autoImgBareRe.lastIndex = 0
  while ((match = autoImgBareRe.exec(raw))) {
    const url = String(match[0] || '').trim()
    if (!url) continue
    const resolved = resolveUrl(baseUrl, url)
    if (!resolved) continue
    if (!isLikelyImageUrl(resolved)) continue
    const key = `autoimg:${resolved}`
    if (seenMedia.has(key)) continue
    seenMedia.add(key)
    images.push({ alt: '', url: resolved })
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
