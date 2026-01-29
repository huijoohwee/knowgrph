import { extractWikiLinksFromMarkdown, normalizeLooseKey } from './wikiLinks.js'

export type MarkdownBacklink = {
  sourceDocKey: string
  sourceLabel: string
  count: number
}

const stripMarkdownExtension = (value: string) =>
  String(value || '').replace(/\.(md|markdown)$/i, '')

const basename = (value: string) => {
  const raw = String(value || '').trim()
  const parts = raw.split('/')
  return parts.length ? String(parts[parts.length - 1] || raw) : raw
}

export const normalizeLooseDocKey = (value: string): string => {
  const base = basename(stripMarkdownExtension(String(value || '').trim()))
  return normalizeLooseKey(base)
}

export const computeMarkdownBacklinks = (args: {
  targetDocKey: string
  sources: Array<{ docKey: string; text?: string | null }>
}): MarkdownBacklink[] => {
  const targetKey = normalizeLooseDocKey(args.targetDocKey)
  if (!targetKey) return []

  const counts = new Map<string, { sourceDocKey: string; count: number }>()

  for (const s of args.sources || []) {
    const sourceDocKey = String(s.docKey || '').trim()
    if (!sourceDocKey) continue
    if (normalizeLooseDocKey(sourceDocKey) === targetKey) continue

    const text = String(s.text || '')
    if (!text.trim()) continue

    const links = extractWikiLinksFromMarkdown(text)
    for (const link of links) {
      const docKey = link.docKey ? String(link.docKey || '').trim() : ''
      if (!docKey) continue
      if (normalizeLooseDocKey(docKey) !== targetKey) continue
      const prev = counts.get(sourceDocKey)
      if (prev) {
        prev.count += 1
      } else {
        counts.set(sourceDocKey, { sourceDocKey, count: 1 })
      }
    }
  }

  return Array.from(counts.values())
    .map(v => ({ sourceDocKey: v.sourceDocKey, sourceLabel: v.sourceDocKey, count: v.count }))
    .sort((a, b) => (b.count - a.count) || a.sourceLabel.localeCompare(b.sourceLabel))
}
