import type { WebpageViewMode } from '@/lib/markdown/frontmatter'

export type WebsiteImportArtifactKind = 'rawHtml' | 'markdown' | 'conversionJson' | 'wireframeMarkdown' | 'wireframeEnhancedMarkdown'

export function websiteImportArtifactKindForWebpageView(view: WebpageViewMode): WebsiteImportArtifactKind {
  if (view === 'json') return 'conversionJson'
  if (view === 'html') return 'rawHtml'
  if (view === 'wireframe') return 'wireframeMarkdown'
  if (view === 'wireframe-enhanced') return 'wireframeEnhancedMarkdown'
  return 'markdown'
}
