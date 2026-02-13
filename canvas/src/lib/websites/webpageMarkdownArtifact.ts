import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { buildWebpageMarkdownArtifactFromMarkdown } from './webpageMarkdownArtifactGenerator'

export function looksLikeWebpageMarkdownArtifactDoc(raw: string): boolean {
  const text = String(raw || '')
  if (!text.trim()) return false
  if (/^#\s+Webpage\s+Markdown\s+Artifact:/m.test(text)) return true
  return false
}

export function buildWebpageMarkdownArtifactDoc(args: { markdown: string; url: string; title?: string }): string {
  const doc = buildWebpageMarkdownArtifactFromMarkdown({
    markdown: String(args.markdown || ''),
    url: String(args.url || ''),
    title: args.title,
  })
  return upsertWebpageFrontmatterMeta(doc, { url: args.url, view: 'markdown' })
}
