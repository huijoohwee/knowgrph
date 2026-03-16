import { inferMediaKindFromUrl } from './mediaKind.js'

export type MarkdownMediaUrls = {
  images: string[]
  videos: string[]
  links: string[]
}

const ABS_HTTP_RE = /^https?:\/\//i

const normalizeCandidateUrl = (raw: unknown): string => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  const withoutAngles = trimmed.replace(/^<|>$/g, '').trim()
  if (!withoutAngles) return ''
  return withoutAngles
}

const pushUnique = (list: string[], seen: Set<string>, raw: unknown, max: number): void => {
  const s = normalizeCandidateUrl(raw)
  if (!s) return
  if (!ABS_HTTP_RE.test(s)) return
  if (seen.has(s)) return
  seen.add(s)
  if (list.length < max) list.push(s)
}

export function extractMarkdownMediaUrls(text: string, maxEach = 24): MarkdownMediaUrls {
  const src = String(text || '')
  const limit = Number.isFinite(maxEach) ? Math.max(1, Math.floor(maxEach)) : 24
  const images: string[] = []
  const videos: string[] = []
  const links: string[] = []
  const seenImages = new Set<string>()
  const seenVideos = new Set<string>()
  const seenLinks = new Set<string>()
  const classifyAndPush = (rawUrl: unknown) => {
    const url = normalizeCandidateUrl(rawUrl)
    if (!url) return
    if (!ABS_HTTP_RE.test(url)) return
    const kind = inferMediaKindFromUrl(url)
    if (kind === 'image' || kind === 'svg') {
      pushUnique(images, seenImages, url, limit)
      return
    }
    if (kind === 'video') {
      pushUnique(videos, seenVideos, url, limit)
      return
    }
    pushUnique(links, seenLinks, url, limit)
  }

  const imageRe = /!\[[^\]]*\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g
  for (const m of src.matchAll(imageRe)) {
    const chunk = String(m[1] || '').trim()
    const url = chunk.split(/\s+/)[0] || ''
    classifyAndPush(url)
  }

  const linkRe = /\[[^\]]+\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g
  for (const m of src.matchAll(linkRe)) {
    const chunk = String(m[1] || '').trim()
    const url = chunk.split(/\s+/)[0] || ''
    classifyAndPush(url)
  }

  const bareRe = /https?:\/\/[^\s<>()]+/g
  for (const m of src.matchAll(bareRe)) {
    classifyAndPush(m[0])
  }

  return { images, videos, links }
}
