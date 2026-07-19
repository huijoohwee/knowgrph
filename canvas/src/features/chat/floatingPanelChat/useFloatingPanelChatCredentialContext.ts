import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { resolveFloatingPanelChatCredentialContext } from './floatingPanelChatCredentialContext'

export function useFloatingPanelChatCredentialContext(args: {
  graphData: GraphData | null
  graphDataRevision: number
  selectedNodeId: string | null
  globalProvider: unknown
  globalAuthMode: unknown
  globalEndpointUrl: unknown
  globalModel: unknown
}) {
  const currentNode = React.useMemo(() => {
    if (!args.graphData || !args.selectedNodeId) return null
    const graphSemanticKey = buildScopedGraphSemanticKey('floating-panel-chat-graph', {
      graphData: args.graphData,
      graphRevision: args.graphDataRevision,
    })
    return getCachedGraphLookup({
      cacheScope: 'floating-panel-chat-graph',
      graphData: args.graphData,
      graphRevision: args.graphDataRevision,
      graphSemanticKey,
      preferCurrentGraphDataRefs: true,
    }).nodeById.get(args.selectedNodeId) || null
  }, [args.graphData, args.graphDataRevision, args.selectedNodeId])
  const credentialContext = React.useMemo(() => resolveFloatingPanelChatCredentialContext({
    currentNode,
    globalProvider: args.globalProvider,
    globalAuthMode: args.globalAuthMode,
    globalEndpointUrl: args.globalEndpointUrl,
    globalModel: args.globalModel,
  }), [args.globalAuthMode, args.globalEndpointUrl, args.globalModel, args.globalProvider, currentNode])
  return { currentNode, credentialContext }
}
