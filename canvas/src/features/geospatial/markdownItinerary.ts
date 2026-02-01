import { hashStringToHex } from '../../lib/hash/stringHash'

export type MarkdownItineraryPoi = {
  id: string
  label: string
  tokens: string[]
  sectionMarkdown: string
  media: { images: string[]; videos: string[]; links: string[] }
}

const extractUrls = (markdown: string): { images: string[]; videos: string[]; links: string[] } => {
  const images: string[] = []
  const links: string[] = []
  const videos: string[] = []

  const imgRe = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g
  for (const m of markdown.matchAll(imgRe)) {
    const url = String(m[1] || '').trim()
    if (url) images.push(url)
  }

  const linkRe = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g
  for (const m of markdown.matchAll(linkRe)) {
    const url = String(m[1] || '').trim()
    if (url) links.push(url)
  }

  for (const u of links) {
    if (/(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(u)) videos.push(u)
  }

  return {
    images: Array.from(new Set(images)).slice(0, 12),
    videos: Array.from(new Set(videos)).slice(0, 8),
    links: Array.from(new Set(links)).slice(0, 20),
  }
}

const extractAirportCodes = (markdown: string): string[] => {
  const codes: string[] = []
  const re = /\(([A-Z]{3})\)/g
  for (const m of markdown.matchAll(re)) {
    const c = String(m[1] || '').trim().toUpperCase()
    if (c) codes.push(c)
  }
  return Array.from(new Set(codes)).slice(0, 12)
}

const extractLikelyPlaceWords = (heading: string): string[] => {
  const cleaned = String(heading || '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bLEG\b/gi, ' ')
    .replace(/\bDAYS?\b/gi, ' ')
    .replace(/\bTRANSIT\b/gi, ' ')
    .replace(/\bFLY\b/gi, ' ')
    .replace(/\bDEPART\b/gi, ' ')
    .replace(/[—–→]/g, ' ')
    .replace(/[^A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return []
  const words = cleaned
    .split(' ')
    .map(w => w.trim())
    .filter(Boolean)
  const candidates: string[] = []
  const upperRuns: string[] = []
  for (const w of words) {
    if (w.length >= 3 && w.toUpperCase() === w) {
      upperRuns.push(w)
    } else {
      if (upperRuns.length > 0) {
        candidates.push(upperRuns.join(' '))
        upperRuns.length = 0
      }
    }
  }
  if (upperRuns.length > 0) candidates.push(upperRuns.join(' '))
  const out = candidates.length > 0 ? candidates : [cleaned]
  return Array.from(new Set(out)).slice(0, 6)
}

export function extractMarkdownItineraryPois(markdownText: string): MarkdownItineraryPoi[] {
  const md = String(markdownText || '').replace(/\r\n/g, '\n')
  if (!md.trim()) return []

  const sections: Array<{ heading: string; body: string }> = []
  const headingRe = /^###\s+(.+)$/gm
  const matches = Array.from(md.matchAll(headingRe))
  if (matches.length === 0) return []

  for (let i = 0; i < matches.length; i += 1) {
    const heading = String(matches[i][1] || '').trim()
    const start = (matches[i].index ?? 0) + String(matches[i][0] || '').length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? md.length) : md.length
    const body = md.slice(start, end).trim()
    sections.push({ heading, body })
  }

  const pois: MarkdownItineraryPoi[] = []
  for (const sec of sections) {
    const label = sec.heading
    const codes = extractAirportCodes(sec.body)
    const placeWords = extractLikelyPlaceWords(sec.heading)
    const tokens = Array.from(new Set([...codes, ...placeWords])).filter(Boolean)
    if (tokens.length === 0) continue
    const id = `mdpoi:${hashStringToHex(`${label}|${tokens.join('|')}`)}`
    pois.push({
      id,
      label,
      tokens,
      sectionMarkdown: `### ${sec.heading}\n\n${sec.body}`.trim(),
      media: extractUrls(sec.body),
    })
  }
  return pois
}
