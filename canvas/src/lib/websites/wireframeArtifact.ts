import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { extractWireframeMockupAndTailFromMarkdownDoc } from '@/lib/markdown/wireframeAscii'
import { buildWireframeMarkdownFromMarkdown, type WebpageWireframeDetailLevel } from './wireframe'

export function buildAsciiWireframeArtifactDoc(args: {
  markdown: string
  url: string
  detailLevel?: WebpageWireframeDetailLevel
  title?: string
}): string {
  const wireframe = buildWireframeMarkdownFromMarkdown({
    markdown: String(args.markdown || ''),
    url: String(args.url || ''),
    detailLevel: args.detailLevel,
    title: args.title,
  })
  const { mockup, tail } = extractWireframeMockupAndTailFromMarkdownDoc(wireframe)

  const host = (() => {
    try {
      return new URL(String(args.url || '')).host
    } catch {
      return String(args.url || '')
    }
  })()

  const docParts: string[] = []
  docParts.push(`# ASCII Wireframe: ${host}`)
  docParts.push('')
  docParts.push('```text kg-wireframe')
  docParts.push(String(mockup || '').trimEnd())
  docParts.push('```')

  if (String(tail || '').trim()) {
    docParts.push('')
    docParts.push('## Document Structure')
    docParts.push('')
    docParts.push('```text')
    docParts.push(String(tail || '').trimEnd())
    docParts.push('```')
  }

  return upsertWebpageFrontmatterMeta(docParts.join('\n') + '\n', { url: args.url, view: 'wireframe' })
}

export function looksLikeAsciiWireframeArtifactDoc(raw: string): boolean {
  const s = String(raw || '')
  return s.includes('# ASCII Wireframe:') && s.includes('```text kg-wireframe')
}
