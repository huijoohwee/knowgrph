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

export function hasLiveCanvasHeroBlockingSearchParams(search: string, _rootAliasPath: string): boolean {
  const rawSearch = String(search || '').trim()
  if (!rawSearch) return false
  const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch)
  // The single-root runtime rewrites a direct workspace route such as
  // /knowgrph/ to /?kgPath=/knowgrph/. That remains workspace ownership, not
  // a Home alias. Treat every route query as a boundary for the apex hero.
  return Array.from(params.entries()).length > 0
}

export function shouldShowLiveCanvasHero(args: LiveCanvasHeroVisibilityArgs): boolean {
  if (!args.isRootAlias || !args.sourceFilesBootstrapReady || !args.liveWorkspaceSourceReady || args.dismissed) return false
  if (args.hasSearchParams || args.isEmbeddedPreview) return false
  if (args.workspaceDocumentSwitchPending) return false
  return true
}
