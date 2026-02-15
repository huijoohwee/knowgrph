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
  if (looksLikeWebpageMarkdownArtifactDoc(markdown)) return upsertWebpageFrontmatterMeta(markdown, { url: args.url, view: 'markdown' })
  const doc = buildWebpageMarkdownArtifactFromMarkdown({
    markdown,
    url: String(args.url || ''),
    title: args.title,
    fidelityMaxLevel: args.fidelityMaxLevel,
  })
  return upsertWebpageFrontmatterMeta(doc, { url: args.url, view: 'markdown' })
}
