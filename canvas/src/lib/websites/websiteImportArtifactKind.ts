import type { WebpageViewMode } from '@/lib/markdown/frontmatter'

export type WebsiteImportArtifactKind = 'rawHtml' | 'markdown' | 'conversionJson'

export function websiteImportArtifactKindForWebpageView(view: WebpageViewMode): WebsiteImportArtifactKind {
  if (view === 'json') return 'conversionJson'
  if (view === 'html') return 'rawHtml'
  return 'markdown'
}
