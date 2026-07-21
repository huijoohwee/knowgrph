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

const HOME_OWNED_SEARCH_PARAMS = new Set([
  'kgCanvas2dRenderer',
  'kgCanvasRenderMode',
  'kgCanvasSurfaceMode',
  'kgReleaseProof',
  'kgTrace',
  'openEditorWorkspace',
])

const normalizeRoutePath = (value: string): string => {
  const rawPath = String(value || '').trim()
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}

export function hasLiveCanvasHeroBlockingSearchParams(search: string, rootAliasPath: string): boolean {
  const rawSearch = String(search || '').trim()
  if (!rawSearch) return false
  const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch)
  const normalizedRootAliasPath = normalizeRoutePath(rootAliasPath)
  for (const [name, value] of params) {
    if (HOME_OWNED_SEARCH_PARAMS.has(name)) continue
    if (name === 'kgPath') {
      const routePath = normalizeRoutePath(value)
      if (routePath.startsWith(`${normalizedRootAliasPath}/share/`)) continue
    }
    return true
  }
  return false
}

export function shouldShowLiveCanvasHero(args: LiveCanvasHeroVisibilityArgs): boolean {
  if (!args.isRootAlias || !args.sourceFilesBootstrapReady || !args.liveWorkspaceSourceReady || args.dismissed) return false
  if (args.hasSearchParams || args.isEmbeddedPreview) return false
  if (args.workspaceDocumentSwitchPending) return false
  return true
}

export function shouldDocumentSwitchOwnCanvasViewport(args: {
  documentSwitchBlocksCanvas: boolean
  liveCanvasHeroVisible: boolean
}): boolean {
  return args.documentSwitchBlocksCanvas && !args.liveCanvasHeroVisible
}
