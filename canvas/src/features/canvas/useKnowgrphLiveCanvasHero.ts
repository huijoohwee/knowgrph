import React from 'react'
import { getSourceFileTextHash } from '@/features/source-files/sourceFilesSignatures'
import {
  isDefaultWorkspaceSeedSourcePath,
  resolveWorkspaceSeedSourcePath,
  WORKSPACE_README_SOURCE_PATH,
} from '@/features/source-files/workspaceSeedSourceFiles'
import type { SourceFile } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import { isRouterRootAliasRuntime } from '@/lib/routing/basePath'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { shouldShowLiveCanvasHero } from './liveCanvasHeroVisibility'

export type LiveCanvasHeroWorkspaceSourceState = {
  defaultSeedOnly: boolean
  defaultSeedContentSignature: string | null
  meaningfulSourceFilesPresent: boolean
}

export type LiveCanvasHeroSource = {
  sourceFileId: string
  sourcePath: string
  graphData: GraphData
  canvasGraphData: GraphData
  graphRevision: number
  graphId: string
  schema: string
  sourceLayerHash: string
}

const LIVE_CANVAS_HERO_INITIALIZATION_SOURCE_BASENAME = 'knowgrph-strybldr-starter-template.md'

const isLiveCanvasHeroInitializationSourcePath = (path: string): boolean => (
  isDefaultWorkspaceSeedSourcePath(path)
  || path.replace(/\\/g, '/').toLowerCase().startsWith('workspace:/docs/')
  || path.replace(/\\/g, '/').split('/').pop()?.toLowerCase() === LIVE_CANVAS_HERO_INITIALIZATION_SOURCE_BASENAME
)

export function deriveLiveCanvasHeroCommandRouteGraph(graphData: GraphData): GraphData | null {
  const commandNodeIdSet = new Set((graphData.nodes || [])
    .filter(node => String(node.properties?.command || '').trim().startsWith('/'))
    .map(node => String(node.id || '').trim())
    .filter(Boolean))
  const edges = (graphData.edges || []).filter(edge => (
    commandNodeIdSet.has(String(edge.source || '').trim())
    && commandNodeIdSet.has(String(edge.target || '').trim())
  ))
  const connectedNodeIdSet = new Set(edges.flatMap(edge => [String(edge.source || '').trim(), String(edge.target || '').trim()]))
  const nodes = (graphData.nodes || []).filter(node => connectedNodeIdSet.has(String(node.id || '').trim()))
  if (nodes.length < 2 || edges.length === 0) {
    const sourceNodeIds = new Set((graphData.nodes || []).map(node => String(node.id || '').trim()).filter(Boolean))
    const firstEdge = (graphData.edges || []).find(edge => (
      sourceNodeIds.has(String(edge.source || '').trim())
      && sourceNodeIds.has(String(edge.target || '').trim())
    ))
    if (!firstEdge) return null
    const routeEdges = [firstEdge]
    const firstTargetId = String(firstEdge.target || '').trim()
    const continuationEdge = (graphData.edges || []).find(edge => (
      String(edge.source || '').trim() === firstTargetId
      && sourceNodeIds.has(String(edge.target || '').trim())
    ))
    if (continuationEdge) routeEdges.push(continuationEdge)
    const routeNodeIds = new Set(routeEdges.flatMap(edge => [String(edge.source || '').trim(), String(edge.target || '').trim()]))
    const routeNodes = (graphData.nodes || []).filter(node => routeNodeIds.has(String(node.id || '').trim()))
    return {
      ...graphData,
      nodes: routeNodes,
      edges: routeEdges,
      metadata: {
        ...graphData.metadata,
        liveCanvasHeroProjection: {
          kind: 'source-connected-route',
          sourceNodeCount: graphData.nodes.length,
          sourceEdgeCount: graphData.edges.length,
        },
      },
    }
  }
  return {
    ...graphData,
    nodes,
    edges,
    metadata: {
      ...graphData.metadata,
      liveCanvasHeroProjection: {
        kind: 'source-command-route',
        sourceNodeCount: graphData.nodes.length,
        sourceEdgeCount: graphData.edges.length,
      },
    },
  }
}

const readGraphMetadata = (graphData: GraphData | null | undefined): Record<string, unknown> => {
  const metadata = graphData?.metadata
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
}

const readFrontmatterMetadata = (graphData: GraphData): Record<string, unknown> => {
  const frontmatter = readGraphMetadata(graphData).frontmatterMeta
  return frontmatter && typeof frontmatter === 'object' && !Array.isArray(frontmatter)
    ? frontmatter as Record<string, unknown>
    : {}
}

export function resolveLiveCanvasHeroSource(args: {
  sourceFiles: SourceFile[]
  activeGraphData: GraphData | null | undefined
}): LiveCanvasHeroSource | null {
  const sourceFile = (Array.isArray(args.sourceFiles) ? args.sourceFiles : []).find(file => {
    if (!file) return false
    const sourcePath = file.source?.path || file.source?.url || file.name
    return resolveWorkspaceSeedSourcePath(sourcePath) === WORKSPACE_README_SOURCE_PATH
  })
  if (!sourceFile || sourceFile.status === 'error') return null

  const sourceFileId = String(sourceFile.id || '').trim()
  const text = String(sourceFile.text || '')
  if (!sourceFileId || !text.trim()) return null
  const sourceTextGraphData = tryParseMarkdownFrontmatterFlowGraph(
    String(sourceFile.name || 'workspace-readme.md'),
    text,
  )?.graphData || null
  const graphDataCandidates = [sourceTextGraphData, sourceFile.parsedGraphData, args.activeGraphData]
    .filter((candidate): candidate is GraphData => candidate != null)
  const resolvedGraph = graphDataCandidates
    .map(graphData => ({ graphData, canvasGraphData: deriveLiveCanvasHeroCommandRouteGraph(graphData) }))
    .find(candidate => candidate.canvasGraphData != null)
  if (!resolvedGraph) return null

  const { graphData, canvasGraphData } = resolvedGraph
  const graphItemCount = (graphData.nodes?.length || 0) + (graphData.edges?.length || 0)
  const sourceLayerHash = String(readGraphMetadata(graphData).sourceLayerHash || getSourceFileTextHash(sourceFile)).trim()
  if (graphItemCount === 0 || !sourceLayerHash) return null

  const frontmatter = readFrontmatterMetadata(graphData)
  return {
    sourceFileId,
    sourcePath: WORKSPACE_README_SOURCE_PATH,
    graphData,
    canvasGraphData: canvasGraphData as GraphData,
    graphRevision: Number.isFinite(sourceFile.parsedGraphRevision) ? Number(sourceFile.parsedGraphRevision) : 0,
    graphId: String(frontmatter.graphId || '').trim(),
    schema: String(frontmatter.schema || '').trim(),
    sourceLayerHash,
  }
}

export function resolveLiveCanvasHeroWorkspaceSourceState(args: {
  sourceFiles: SourceFile[]
  markdownDocumentName: string | null | undefined
}): LiveCanvasHeroWorkspaceSourceState {
  const enabledSources = (Array.isArray(args.sourceFiles) ? args.sourceFiles : [])
    .filter(sourceFile => sourceFile?.enabled !== false)
  const sourcePaths = enabledSources.map(sourceFile => (
    String(sourceFile?.source?.path || sourceFile?.source?.url || sourceFile?.name || '').trim()
  ))
  const meaningfulSourceFilesPresent = sourcePaths.some(path => !isLiveCanvasHeroInitializationSourcePath(path))
  const defaultSeedDocumentActive = isLiveCanvasHeroInitializationSourcePath(String(args.markdownDocumentName || ''))
  const hasDefaultSeedSource = sourcePaths.some(path => isLiveCanvasHeroInitializationSourcePath(path))
  const defaultSeedContentSignature = enabledSources
    .filter((sourceFile, index) => isLiveCanvasHeroInitializationSourcePath(sourcePaths[index]))
    .map(sourceFile => [
      String(sourceFile.id || ''),
      String(sourceFile.source?.path || sourceFile.source?.url || sourceFile.name || ''),
      getSourceFileTextHash(sourceFile),
    ].join(':'))
    .sort()
    .join('|') || null
  return {
    meaningfulSourceFilesPresent,
    defaultSeedOnly: !meaningfulSourceFilesPresent && (hasDefaultSeedSource || defaultSeedDocumentActive),
    defaultSeedContentSignature,
  }
}

export function useKnowgrphLiveCanvasHero(args: {
  graphData: GraphData | null | undefined
  sourceFiles: SourceFile[]
  markdownDocumentName: string | null | undefined
  markdownDocumentText: string | null | undefined
  sourceFilesBootstrapReady: boolean
  isEmbeddedPreview: boolean
  workspaceEditorOverlayOpen: boolean
  workspaceDocumentSwitchPending: boolean
  floatingPanelOpen: boolean
  alternateCanvasSurfaceActive: boolean
}) {
  const sourceState = resolveLiveCanvasHeroWorkspaceSourceState({
    sourceFiles: args.sourceFiles,
    markdownDocumentName: args.markdownDocumentName,
  })
  const liveCanvasHeroSource = React.useMemo(() => resolveLiveCanvasHeroSource({
    sourceFiles: args.sourceFiles,
    activeGraphData: args.graphData,
  }), [args.graphData, args.sourceFiles])
  const graphItemCount = (args.graphData?.nodes?.length || 0) + (args.graphData?.edges?.length || 0)
  const hasDocumentText = String(args.markdownDocumentText || '').trim().length > 0
  const [defaultSeedBaselineSignature, setDefaultSeedBaselineSignature] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!args.sourceFilesBootstrapReady || !sourceState.defaultSeedContentSignature) return
    setDefaultSeedBaselineSignature(current => current ?? sourceState.defaultSeedContentSignature)
  }, [args.sourceFilesBootstrapReady, sourceState.defaultSeedContentSignature])
  const defaultSeedContentChanged = defaultSeedBaselineSignature != null
    && sourceState.defaultSeedContentSignature != null
    && defaultSeedBaselineSignature !== sourceState.defaultSeedContentSignature
  const meaningfulWorkspaceContent = sourceState.meaningfulSourceFilesPresent
    || defaultSeedContentChanged
    || (!sourceState.defaultSeedOnly && (graphItemCount > 0 || hasDocumentText))
  const [landingExited, setLandingExited] = React.useState(false)
  const isRootAlias = isRouterRootAliasRuntime(import.meta.env.BASE_URL)
  const authoredOwnershipReady = args.sourceFilesBootstrapReady
    && args.workspaceDocumentSwitchPending !== true
    && args.graphData?.metadata?.pending !== true
    && meaningfulWorkspaceContent

  // Once authored content takes ownership, transient parser recomposition must
  // not revive the landing surface later in the same app session.
  React.useEffect(() => {
    if (authoredOwnershipReady && !isRootAlias) setLandingExited(true)
  }, [authoredOwnershipReady, isRootAlias])

  const hasSearchParams = typeof window !== 'undefined' && String(window.location.search || '').trim().length > 0
  const visible = shouldShowLiveCanvasHero({
    isRootAlias,
    sourceFilesBootstrapReady: args.sourceFilesBootstrapReady,
    liveWorkspaceSourceReady: liveCanvasHeroSource != null,
    dismissed: landingExited || (!isRootAlias && defaultSeedContentChanged),
    hasSearchParams,
    isEmbeddedPreview: args.isEmbeddedPreview,
    workspaceEditorOverlayOpen: args.workspaceEditorOverlayOpen,
    workspaceDocumentSwitchPending: args.workspaceDocumentSwitchPending,
    floatingPanelOpen: args.floatingPanelOpen,
    alternateCanvasSurfaceActive: args.alternateCanvasSurfaceActive,
    defaultSeedOnly: sourceState.defaultSeedOnly,
    meaningfulSourceFilesPresent: sourceState.meaningfulSourceFilesPresent,
    graphData: args.graphData,
    markdownDocumentText: args.markdownDocumentText,
  })
  return {
    liveCanvasHeroVisible: visible,
    liveCanvasHeroSource,
    dismissLiveCanvasHero: () => setLandingExited(true),
  }
}
