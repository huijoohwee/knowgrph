import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { buildWireframeEnhancedMarkdownFromMarkdown } from './wireframeEnhanced'

export function buildWireframeEnhancedArtifactDoc(args: { markdown: string; url: string; title?: string }): string {
  const doc = buildWireframeEnhancedMarkdownFromMarkdown({
    markdown: String(args.markdown || ''),
    url: String(args.url || ''),
    title: args.title,
  })
  return upsertWebpageFrontmatterMeta(doc, { url: args.url, view: 'wireframe-enhanced' })
}

