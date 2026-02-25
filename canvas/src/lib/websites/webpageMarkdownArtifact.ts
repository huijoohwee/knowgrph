import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { buildWebpageMarkdownArtifactFromMarkdown } from './webpageMarkdownArtifactGenerator'

export function looksLikeWebpageMarkdownArtifactDoc(raw: string): boolean {
  const text = String(raw || '')
  if (!text.trim()) return false
  if (/^##\s+(?:📋\s+)?table\s+of\s+contents\s*$/im.test(text)) return true
  if (/^##\s+(?:🏗️\s+)?page\s+structure\s+overview\s*$/im.test(text)) return true
  if (/^##\s+(?:🧱\s+)?document\s+structure\s*$/im.test(text)) return true
  return false
}

export function buildWebpageMarkdownArtifactDoc(args: {
  markdown: string
  url: string
  title?: string
  fidelityMaxLevel?: number
}): string {
  const markdown = String(args.markdown || '')
  const SOURCE_FAITHFUL_MARKER = 'Source-Faithful (No Invented Content)'
  const appendSourceFaithfulSection = (text: string): string => {
    const base = String(text || '').trimEnd()
    if (!base) return base
    if (base.includes(SOURCE_FAITHFUL_MARKER)) return base
    const body = (() => {
      const raw = base.replace(/^---[\s\S]*?\n---\n?/m, '').trim()
      if (!raw) return ''
      const marker = '## RAW HTML → MARKDOWN (Full Page Text)'
      const markerIdx = raw.indexOf(marker)
      if (markerIdx >= 0) {
        const after = raw.slice(markerIdx + marker.length).replace(/^\s*\n/, '')
        const cutIdx = after.search(/\n---\n|^##\s+RAW HTML SNAPSHOT/m)
        const sliced = (cutIdx >= 0 ? after.slice(0, cutIdx) : after).trim()
        if (sliced) return sliced
      }
      const domMarker = '## RAW DOM TEXT SNAPSHOT'
      const domIdx = raw.indexOf(domMarker)
      if (domIdx >= 0) {
        const after = raw.slice(domIdx + domMarker.length).replace(/^\s*\n/, '')
        const cutIdx = after.search(/\n---\n|^##\s+/m)
        const sliced = (cutIdx >= 0 ? after.slice(0, cutIdx) : after).trim()
        if (sliced) return sliced
      }
      return raw
    })()
    if (!body) return base
    const out = [
      base,
      '',
      '---',
      '',
      '## Source-Faithful Full Page Markdown',
      '',
      `**Fidelity Level:** 100% ${SOURCE_FAITHFUL_MARKER}`,
      '',
      body,
      '',
      '---',
      '',
    ]
    return out.join('\n')
  }
  if (looksLikeWebpageMarkdownArtifactDoc(markdown)) {
    const next = appendSourceFaithfulSection(markdown)
    return upsertWebpageFrontmatterMeta(next, { url: args.url, view: 'markdown' })
  }
  const doc = buildWebpageMarkdownArtifactFromMarkdown({
    markdown,
    url: String(args.url || ''),
    title: args.title,
    fidelityMaxLevel: args.fidelityMaxLevel,
  })
  const withMarker = appendSourceFaithfulSection(doc)
  return upsertWebpageFrontmatterMeta(withMarker, { url: args.url, view: 'markdown' })
}
