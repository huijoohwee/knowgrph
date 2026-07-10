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

export function shouldShowLiveCanvasHero(args: LiveCanvasHeroVisibilityArgs): boolean {
  if (!args.isRootAlias || !args.sourceFilesBootstrapReady || !args.liveWorkspaceSourceReady || args.dismissed) return false
  if (args.hasSearchParams || args.isEmbeddedPreview) return false
  if (args.workspaceDocumentSwitchPending) return false
  if (args.floatingPanelOpen || args.alternateCanvasSurfaceActive) return false
  if (args.meaningfulSourceFilesPresent) return false
  if (args.graphData?.metadata?.pending === true) return false

  const graphItemCount = (args.graphData?.nodes?.length || 0) + (args.graphData?.edges?.length || 0)
  const hasDocumentText = String(args.markdownDocumentText || '').trim().length > 0
  if (graphItemCount === 0 && !hasDocumentText) return true
  return args.defaultSeedOnly
}
