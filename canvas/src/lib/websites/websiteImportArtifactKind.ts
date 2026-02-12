import type { WebpageViewMode } from '@/lib/markdown/frontmatter'

export type WebsiteImportArtifactKind = 'rawHtml' | 'markdown' | 'conversionJson' | 'wireframeMarkdown'

export function websiteImportArtifactKindForWebpageView(view: WebpageViewMode): WebsiteImportArtifactKind {
  if (view === 'json') return 'conversionJson'
  if (view === 'wireframe') return 'wireframeMarkdown'
  return 'markdown'
}
