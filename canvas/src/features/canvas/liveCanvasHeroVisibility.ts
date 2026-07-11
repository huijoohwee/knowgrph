import type { GraphData } from '@/lib/graph/types'

export type LiveCanvasHeroVisibilityArgs = {
  isRootAlias: boolean
  sourceFilesBootstrapReady: boolean
  liveWorkspaceSourceReady: boolean
  dismissed: boolean
  hasSearchParams: boolean
  isEmbeddedPreview: boolean
  workspaceEditorOverlayOpen: boolean
  workspaceDocumentSwitchPending: boolean
  floatingPanelOpen: boolean
  alternateCanvasSurfaceActive: boolean
  defaultSeedOnly: boolean
  meaningfulSourceFilesPresent: boolean
  graphData: GraphData | null | undefined
  markdownDocumentText: string | null | undefined
}

function normalizeRoutePath(value: string): string {
  const trimmed = value.trim()
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : '/'
}

export function hasLiveCanvasHeroBlockingSearchParams(search: string, rootAliasPath: string): boolean {
  const rawSearch = String(search || '').trim()
  if (!rawSearch) return false
  const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch)
  const entries = Array.from(params.entries())
  if (entries.length === 0) return false
  const normalizedRootAliasPath = normalizeRoutePath(rootAliasPath)
  return !entries.every(([key, value]) => (
    key === 'kgPath' && normalizeRoutePath(value) === normalizedRootAliasPath
  ))
}

export function shouldShowLiveCanvasHero(args: LiveCanvasHeroVisibilityArgs): boolean {
  if (!args.isRootAlias || !args.sourceFilesBootstrapReady || !args.liveWorkspaceSourceReady || args.dismissed) return false
  if (args.hasSearchParams || args.isEmbeddedPreview) return false
  if (args.workspaceDocumentSwitchPending) return false
  return true
}
