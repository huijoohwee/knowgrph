import React from 'react'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  deriveWidgetCandidateNodeIds,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { buildWidgetBundleJsonText } from '@/lib/graph/io/widgetBundle'
import {
  hashArrayOfObjectsSignature,
  hashScopedStringArraySignature,
  hashSignatureParts,
  normalizeStringArrayForSignature,
} from '@/lib/hash/signature'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'

export function useMarkdownWorkspaceWidgetMode(args: {
  active?: boolean
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  graphContentRevision: number
  graphSemanticKey?: string | null
  widgetRegistry: WidgetRegistryEntry[]
  openWidgetNodeIds: string[]
  selectedNodeId: string | null
  activePath: string | null
  isMarkdownPath: (path: string) => boolean
}) {
  const active = args.active !== false
  const activePath = args.activePath
  const isMarkdownPath = args.isMarkdownPath
  const [contentMode, setContentModeState] = React.useState<'document' | 'widget'>('document')
  const wasMarkdownPathRef = React.useRef<boolean>(isMarkdownPath(String(activePath || '')))
  const userForcedDocumentRef = React.useRef(false)
  const setContentMode = React.useCallback((mode: 'document' | 'widget') => {
    userForcedDocumentRef.current = mode === 'document'
    setContentModeState(mode)
  }, [])
  const setContentModeAuto = React.useCallback((mode: 'document' | 'widget') => {
    if (mode === 'document') {
      setContentModeState('document')
      return
    }
    userForcedDocumentRef.current = false
    setContentModeState('widget')
  }, [])
  const [widgetFormat, setWidgetFormat] = React.useState<'json' | 'markdown'>('json')

  const graphNodesRef = React.useRef<GraphNode[]>(args.graphNodes)
  React.useEffect(() => {
    graphNodesRef.current = args.graphNodes
  }, [args.graphNodes])

  const graphEdgesRef = React.useRef<GraphEdge[]>(args.graphEdges)
  React.useEffect(() => {
    graphEdgesRef.current = args.graphEdges
  }, [args.graphEdges])

  const openWidgetNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('open', args.openWidgetNodeIds),
    [args.openWidgetNodeIds],
  )
  const openWidgetNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (openWidgetNodeIdsSnapshotRef.current?.key !== openWidgetNodeIdsKey) {
    openWidgetNodeIdsSnapshotRef.current = {
      key: openWidgetNodeIdsKey,
      value: normalizeStringArrayForSignature(args.openWidgetNodeIds),
    }
  }
  const openWidgetNodeIdsSnapshot = openWidgetNodeIdsSnapshotRef.current.value

  const emptyOpenWidgetNodeIdsKey = React.useMemo(() => hashScopedStringArraySignature('open', []), [])
  const emptyWidgetCandidateIdsKey = React.useMemo(
    () => hashSignatureParts(['candidates', '', emptyOpenWidgetNodeIdsKey]),
    [emptyOpenWidgetNodeIdsKey],
  )
  const widgetCandidateIdsKey = React.useMemo(() => hashSignatureParts([
    'candidates',
    args.selectedNodeId || '',
    openWidgetNodeIdsKey,
  ]), [args.selectedNodeId, openWidgetNodeIdsKey])
  const widgetLookupActive = active && widgetCandidateIdsKey !== emptyWidgetCandidateIdsKey
  const widgetGraphSemanticKey = React.useMemo(() => {
    if (!widgetLookupActive) return ''
    return buildScopedGraphSemanticKey('widget-graph', {
      graphRevision: args.graphContentRevision,
      graphSemanticKey: args.graphSemanticKey,
    })
  }, [args.graphContentRevision, args.graphSemanticKey, widgetLookupActive])

  const widgetRegistryKey = React.useMemo(() => {
    if (!widgetLookupActive) return hashSignatureParts(['registry', 0])
    const entries = args.widgetRegistry
      .map(entry => ({
        id: String(entry?.id || ''),
        isEnabled: entry?.isEnabled === true,
        nodeTypeId: String(entry?.nodeTypeId || ''),
        widgetTypeId: String(entry?.widgetTypeId || ''),
        formId: String(entry?.formId || ''),
        updatedAt: String(entry?.updatedAt || ''),
      }))
      .sort((left, right) =>
        `${left.id}|${left.nodeTypeId}|${left.widgetTypeId}|${left.formId}|${left.updatedAt}`.localeCompare(
          `${right.id}|${right.nodeTypeId}|${right.widgetTypeId}|${right.formId}|${right.updatedAt}`,
        ),
      )
    return hashSignatureParts(['registry', hashArrayOfObjectsSignature(entries, { maxItems: Math.max(30, entries.length), maxKeysPerItem: 6 })])
  }, [args.widgetRegistry, widgetLookupActive])
  const widgetRegistrySnapshotRef = React.useRef<{ key: string; value: WidgetRegistryEntry[] } | null>(null)
  if (widgetRegistrySnapshotRef.current?.key !== widgetRegistryKey) {
    widgetRegistrySnapshotRef.current = { key: widgetRegistryKey, value: widgetLookupActive ? args.widgetRegistry.slice() : [] }
  }
  const widgetRegistrySnapshot = widgetRegistrySnapshotRef.current.value

  const widgetGraphData = React.useMemo<GraphData | null>(() => {
    if (!widgetLookupActive || !widgetGraphSemanticKey) return null
    return {
      type: 'application/json',
      nodes: Array.isArray(args.graphNodes) ? args.graphNodes : [],
      edges: Array.isArray(args.graphEdges) ? args.graphEdges : [],
    }
  }, [args.graphEdges, args.graphNodes, widgetGraphSemanticKey, widgetLookupActive])
  const widgetNodeLookup = React.useMemo(
    () => getCachedGraphLookup({
      cacheScope: 'markdown-workspace-widget-node-lookup',
      graphData: widgetGraphData,
      graphRevision: args.graphContentRevision,
      graphSemanticKey: widgetGraphSemanticKey,
      preferCurrentGraphDataRefs: true,
    }),
    [args.graphContentRevision, widgetGraphData, widgetGraphSemanticKey],
  )
  const graphLookupById = widgetNodeLookup?.nodeById || null
  const graphLookupEdgesByNodeId = widgetNodeLookup?.incidentEdgesByNodeId || null

  const resolvedWidgetNodeIds = React.useMemo(() => {
    if (!widgetLookupActive || !graphLookupById) return []
    return deriveWidgetCandidateNodeIds({
      nodeById: graphLookupById,
      openWidgetNodeIds: openWidgetNodeIdsSnapshot,
      selectedNodeId: args.selectedNodeId,
      registry: widgetRegistrySnapshot,
    })
  }, [args.selectedNodeId, graphLookupById, openWidgetNodeIdsSnapshot, widgetLookupActive, widgetRegistrySnapshot])

  const widgetNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('widgets', resolvedWidgetNodeIds),
    [resolvedWidgetNodeIds],
  )
  const widgetNodeIdsRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (widgetNodeIdsRef.current?.key !== widgetNodeIdsKey) {
    widgetNodeIdsRef.current = { key: widgetNodeIdsKey, value: resolvedWidgetNodeIds }
  }
  const widgetNodeIds = widgetNodeIdsRef.current.value
  const widgetAvailable = widgetNodeIds.length > 0
  const widgetBundleBuildActive = active && contentMode === 'widget' && widgetAvailable
  const widgetBundleSemanticKey = React.useMemo(
    () => hashSignatureParts(['widget-bundle-subset', widgetGraphSemanticKey, widgetNodeIdsKey]),
    [widgetGraphSemanticKey, widgetNodeIdsKey],
  )

  React.useEffect(() => {
    if (contentMode === 'widget' && !widgetAvailable) setContentModeAuto('document')
  }, [contentMode, setContentModeAuto, widgetAvailable])

  React.useEffect(() => {
    const isMarkdownPathActive = isMarkdownPath(String(activePath || ''))
    const wasMarkdownPath = wasMarkdownPathRef.current
    wasMarkdownPathRef.current = isMarkdownPathActive
    if (!widgetAvailable || contentMode === 'widget' || userForcedDocumentRef.current) return
    if (isMarkdownPathActive) return
    if (wasMarkdownPath) return
    setContentModeAuto('widget')
  }, [activePath, contentMode, isMarkdownPath, setContentModeAuto, widgetAvailable])

  const widgetBundleJsonText = React.useMemo(() => {
    if (!widgetBundleBuildActive || widgetNodeIds.length === 0 || !graphLookupById) return ''
    if (!graphLookupEdgesByNodeId) return ''
    const widgetNodeIdSet = new Set(widgetNodeIds)
    const widgetNodes = widgetNodeIds
      .map(id => graphLookupById.get(id) || null)
      .filter((node): node is GraphNode => !!node)
    if (widgetNodes.length === 0) return ''

    const registryNodeTypeIds = new Set(widgetNodes.map(node => String(node.type || '').trim()).filter(Boolean))
    const registryForType = widgetRegistrySnapshot.filter(entry => {
      if (!entry || typeof entry !== 'object') return false
      const rec = entry as { isEnabled?: unknown; nodeTypeId?: unknown }
      if (rec.isEnabled !== true) return false
      return registryNodeTypeIds.has(String(rec.nodeTypeId || '').trim())
    })
    const connectedEdges: GraphEdge[] = []
    const seenEdgeIds = new Set<string>()
    for (let i = 0; i < widgetNodeIds.length; i += 1) {
      const nodeId = widgetNodeIds[i]
      const incidentEdges = graphLookupEdgesByNodeId.get(nodeId) || []
      for (let edgeIndex = 0; edgeIndex < incidentEdges.length; edgeIndex += 1) {
        const edge = incidentEdges[edgeIndex]
        const edgeId = String(edge?.id || '').trim()
        const sourceId = String(edge?.source || '').trim()
        const targetId = String(edge?.target || '').trim()
        const dedupeKey = edgeId || `${sourceId}->${targetId}:${edgeIndex}`
        if (!widgetNodeIdSet.has(sourceId) && !widgetNodeIdSet.has(targetId)) continue
        if (seenEdgeIds.has(dedupeKey)) continue
        seenEdgeIds.add(dedupeKey)
        connectedEdges.push(edge)
      }
    }
    const graph: GraphData = {
      type: 'application/json',
      nodes: widgetNodes,
      edges: connectedEdges,
    }
    return buildWidgetBundleJsonText({
      registryEntries: registryForType,
      graphData: graph,
      graphRevision: args.graphContentRevision,
      graphSemanticKey: widgetBundleSemanticKey,
    })
  }, [args.graphContentRevision, graphLookupById, graphLookupEdgesByNodeId, widgetBundleBuildActive, widgetBundleSemanticKey, widgetNodeIds, widgetRegistrySnapshot])

  const widgetEditorText = React.useMemo(() => {
    if (!widgetAvailable || !widgetBundleJsonText) return ''
    if (widgetFormat === 'markdown') return `\`\`\`json\n${widgetBundleJsonText}\n\`\`\``
    return widgetBundleJsonText
  }, [widgetAvailable, widgetBundleJsonText, widgetFormat])

  const widgetViewerText = React.useMemo(() => {
    if (!widgetAvailable || !widgetBundleJsonText) return ''
    return `\`\`\`json\n${widgetBundleJsonText}\n\`\`\``
  }, [widgetAvailable, widgetBundleJsonText])

  return {
    contentMode,
    setContentMode,
    setContentModeAuto,
    widgetFormat,
    setWidgetFormat,
    widgetAvailable,
    widgetEditorText,
    widgetViewerText,
    graphNodesRef,
    graphEdgesRef,
    userForcedDocumentRef,
  }
}
