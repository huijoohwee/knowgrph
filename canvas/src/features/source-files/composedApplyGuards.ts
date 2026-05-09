import type { GraphData } from '@/lib/graph/types'

export type ComposedApplyGuardLayer = {
  enabled?: boolean
  status?: unknown
  source?: { kind?: unknown; url?: unknown } | null
  text?: unknown
  parsedGraphData?: unknown
}

function hasPendingEnabledRemoteSource(layers: ReadonlyArray<ComposedApplyGuardLayer>): boolean {
  return layers.some(layer => {
    if (!layer.enabled) return false
    const source = layer.source
    if (!source || source.kind !== 'url') return false
    if (String(source.url || '').trim() === '') return false
    if (String(layer.text || '').trim()) return false
    return !layer.parsedGraphData
  })
}

function hasPendingEnabledParse(layers: ReadonlyArray<ComposedApplyGuardLayer>): boolean {
  return layers.some(layer => layer.enabled && String(layer.status || '').trim().toLowerCase() !== 'parsed')
}

function hasPendingEnabledText(layers: ReadonlyArray<ComposedApplyGuardLayer>): boolean {
  return layers.some(layer => layer.enabled && String(layer.text || '').trim() && !layer.parsedGraphData)
}

function hasAnyParsedEnabled(layers: ReadonlyArray<ComposedApplyGuardLayer>): boolean {
  return layers.some(layer => layer.enabled && !!layer.parsedGraphData)
}

function countGraphContent(graphData: GraphData | null | undefined): { nodeCount: number; edgeCount: number; hasContent: boolean } {
  const nodeCount = Array.isArray(graphData?.nodes) ? graphData.nodes.length : 0
  const edgeCount = Array.isArray(graphData?.edges) ? graphData.edges.length : 0
  return {
    nodeCount,
    edgeCount,
    hasContent: nodeCount > 0 || edgeCount > 0,
  }
}

export function shouldClearComposedGraphForEmptyState(args: {
  previousGraphData: GraphData | null | undefined
  hasEnabledSourceFiles: boolean
  hasEnabledContent: boolean
}): boolean {
  const metadata =
    args.previousGraphData?.metadata && typeof args.previousGraphData.metadata === 'object'
      ? (args.previousGraphData.metadata as Record<string, unknown>)
      : {}
  const previousWasComposed = String(metadata.sourceLayerComposition || '') === 'compose'
  if (!previousWasComposed) return false
  return !args.hasEnabledSourceFiles || !args.hasEnabledContent
}

export function resolveComposedApplyDeferralReason(args: {
  layers: ReadonlyArray<ComposedApplyGuardLayer>
  composedGraphData: GraphData | null | undefined
  previousGraphData: GraphData | null | undefined
  workspaceEditorOverlayOpen?: boolean
}): 'pending-remote-source' | 'pending-parse-edge-only' | 'pending-text-without-parsed' | null {
  const { layers } = args
  const composed = countGraphContent(args.composedGraphData)
  const previous = countGraphContent(args.previousGraphData)

  if (!composed.hasContent && hasPendingEnabledRemoteSource(layers)) {
    return 'pending-remote-source'
  }
  if (composed.nodeCount === 0 && composed.edgeCount > 0 && previous.nodeCount > 0 && hasPendingEnabledParse(layers)) {
    return 'pending-parse-edge-only'
  }
  if (!composed.hasContent && previous.hasContent && hasPendingEnabledText(layers) && !hasAnyParsedEnabled(layers)) {
    return 'pending-text-without-parsed'
  }
  return null
}
