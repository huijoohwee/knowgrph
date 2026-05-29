import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'
import { looksLowFidelityWebpageMarkdown } from '@/lib/websites/webpageClientConvert'
import type { WorkspaceUrlContent } from './types'
import type { FetchMode, WebpageViewMode } from './urlContentHeuristics'
import { looksLikeHydrateDisabledSourceLinkStub } from './hydrateDisabledSourceLinkStub'

export const shouldUseCachedWorkspaceUrlContent = (args: {
  mode: FetchMode
  viewHint: WebpageViewMode | ''
  cached: WorkspaceUrlContent | null
}): boolean => {
  const cached = args.cached
  if (!cached) return false
  if (args.mode !== 'import') return true
  if (args.viewHint && args.viewHint !== 'markdown') return true
  const text = String(cached.text || '').trim()
  if (!text) return false
  if (isFrontmatterOnlyDoc(text) || looksLikeHydrateDisabledSourceLinkStub(text)) return false
  return !looksLowFidelityWebpageMarkdown(text)
}

export const shouldCacheWorkspaceUrlContent = (args: {
  mode: FetchMode
  viewHint: WebpageViewMode | ''
  value: WorkspaceUrlContent
}): boolean => {
  const text = String(args.value.text || '').trim()
  if (!text) return false
  if (args.mode !== 'import') return true
  if (args.viewHint && args.viewHint !== 'markdown') return true
  if (isFrontmatterOnlyDoc(text) || looksLikeHydrateDisabledSourceLinkStub(text)) return false
  return !looksLowFidelityWebpageMarkdown(text)
}
