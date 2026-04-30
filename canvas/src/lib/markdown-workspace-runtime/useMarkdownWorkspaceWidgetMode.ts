import React from 'react'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  FLOW_WIDGET_FORM_ID_KEY,
  FLOW_WIDGET_TYPE_ID_KEY,
  resolveWidgetRegistryEntry,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { buildWidgetBundleV1, widgetBundleToJsonText } from '@/lib/graph/io/widgetBundle'
import { hashSignatureParts } from '@/lib/hash/signature'

export function useMarkdownWorkspaceWidgetMode(args: {
  active?: boolean
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  graphContentRevision: number
  widgetRegistry: WidgetRegistryEntry[]
  openWidgetNodeIds: string[]
  selectedNodeId: string | null
  activePath: string | null
  isMarkdownPath: (path: string) => boolean
}) {
  const active = args.active !== false
  const activePath = args.activePath
  const isMarkdownPath = args.isMarkdownPath
  const [contentMode, setContentMode] = React.useState<'document' | 'widget'>('document')
  const wasMarkdownPathRef = React.useRef<boolean>(isMarkdownPath(String(activePath || '')))
  const userForcedDocumentRef = React.useRef(false)
  const setContentModeAuto = React.useCallback((mode: 'document' | 'widget') => {
    if (mode === 'document') {
      setContentMode('document')
      return
    }
    userForcedDocumentRef.current = false
    setContentMode('widget')
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
    () => hashSignatureParts(['open', ...args.openWidgetNodeIds.map(id => String(id || '').trim())]),
    [args.openWidgetNodeIds],
  )
  const openWidgetNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (openWidgetNodeIdsSnapshotRef.current?.key !== openWidgetNodeIdsKey) {
    openWidgetNodeIdsSnapshotRef.current = {
      key: openWidgetNodeIdsKey,
      value: args.openWidgetNodeIds.map(id => String(id || '').trim()),
    }
  }
  const openWidgetNodeIdsSnapshot = openWidgetNodeIdsSnapshotRef.current.value

  const emptyOpenWidgetNodeIdsKey = React.useMemo(() => hashSignatureParts(['open']), [])
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

  const widgetRegistryKey = React.useMemo(() => {
    if (!widgetLookupActive) return hashSignatureParts(['registry', 0])
    const parts: Array<string | number | boolean> = ['registry', args.widgetRegistry.length]
    for (const entry of args.widgetRegistry) {
      parts.push(
        String(entry?.id || ''),
        entry?.isEnabled === true,
        String(entry?.nodeTypeId || ''),
        String(entry?.widgetTypeId || ''),
        String(entry?.formId || ''),
        String(entry?.updatedAt || ''),
      )
    }
    return hashSignatureParts(parts)
  }, [args.widgetRegistry, widgetLookupActive])
  const widgetRegistrySnapshotRef = React.useRef<{ key: string; value: WidgetRegistryEntry[] } | null>(null)
  if (widgetRegistrySnapshotRef.current?.key !== widgetRegistryKey) {
    widgetRegistrySnapshotRef.current = { key: widgetRegistryKey, value: widgetLookupActive ? args.widgetRegistry.slice() : [] }
  }
  const widgetRegistrySnapshot = widgetRegistrySnapshotRef.current.value

  const graphLookupRef = React.useRef<{ revision: number; edges: GraphEdge[]; byId: Map<string, GraphNode> } | null>(null)
  if (widgetLookupActive && graphLookupRef.current?.revision !== args.graphContentRevision) {
    const nodes = Array.isArray(args.graphNodes)
      ? (args.graphNodes as Array<{ id?: unknown; type?: unknown; properties?: unknown }>)
      : []
    const byId = new Map<string, GraphNode>()
    for (const node of nodes) {
      const id = String(node.id || '').trim()
      if (id) byId.set(id, node as GraphNode)
    }
    graphLookupRef.current = {
      revision: args.graphContentRevision,
      edges: Array.isArray(args.graphEdges) ? args.graphEdges : [],
      byId,
    }
  }
  const graphLookup = graphLookupRef.current
  const graphLookupById = graphLookup?.byId || null
  const graphLookupEdges = graphLookup?.edges || null

  const resolvedWidgetNodeIds = React.useMemo(() => {
    if (!widgetLookupActive || !graphLookupById) return []
    const byId = graphLookupById
    const collected: string[] = []
    const seen = new Set<string>()

    const isHeadingSectionNode = (node: { type?: unknown; properties?: unknown } | null): boolean => {
      if (!node || String(node.type || '') !== 'Section') return false
      const props =
        node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
          ? (node.properties as Record<string, unknown>)
          : null
      return typeof props?.level === 'number' && Number.isFinite(props.level)
    }

    const selectedId = typeof args.selectedNodeId === 'string' ? args.selectedNodeId.trim() : ''
    if (selectedId) {
      const node = byId.get(selectedId) || null
      if (!isHeadingSectionNode(node)) {
        const reg = node ? resolveWidgetRegistryEntry({ node: node as never, registry: widgetRegistrySnapshot }) : null
        const props =
          node && typeof node === 'object'
            ? ((node as { properties?: unknown }).properties as Record<string, unknown> | undefined)
            : undefined
        const hasHint =
          !!(typeof props?.[FLOW_WIDGET_TYPE_ID_KEY] === 'string' && String(props?.[FLOW_WIDGET_TYPE_ID_KEY] || '').trim()) ||
          !!(typeof props?.[FLOW_WIDGET_FORM_ID_KEY] === 'string' && String(props?.[FLOW_WIDGET_FORM_ID_KEY] || '').trim())
        if ((reg || hasHint) && !seen.has(selectedId)) {
          seen.add(selectedId)
          collected.push(selectedId)
        }
      }
    }

    for (let i = openWidgetNodeIdsSnapshot.length - 1; i >= 0; i -= 1) {
      const id = openWidgetNodeIdsSnapshot[i]
      if (!id || seen.has(id)) continue
      const node = byId.get(id) || null
      if (!node || isHeadingSectionNode(node)) continue
      seen.add(id)
      collected.push(id)
    }
    return collected.reverse()
  }, [args.selectedNodeId, graphLookupById, openWidgetNodeIdsSnapshot, widgetLookupActive, widgetRegistrySnapshot])

  const widgetNodeIdsKey = React.useMemo(() => hashSignatureParts(['widgets', ...resolvedWidgetNodeIds]), [resolvedWidgetNodeIds])
  const widgetNodeIdsRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (widgetNodeIdsRef.current?.key !== widgetNodeIdsKey) {
    widgetNodeIdsRef.current = { key: widgetNodeIdsKey, value: resolvedWidgetNodeIds }
  }
  const widgetNodeIds = widgetNodeIdsRef.current.value
  const widgetAvailable = widgetNodeIds.length > 0

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
    if (contentMode !== 'widget' || widgetNodeIds.length === 0 || !graphLookupById) return ''
    const edges = Array.isArray(graphLookupEdges) ? graphLookupEdges : []
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
    const connectedEdges = edges.filter(edge => {
      const sourceId = String(edge.source || '').trim()
      const targetId = String(edge.target || '').trim()
      return widgetNodeIdSet.has(sourceId) || widgetNodeIdSet.has(targetId)
    })
    const graph: GraphData = {
      type: 'application/json',
      nodes: widgetNodes,
      edges: connectedEdges,
    }
    return widgetBundleToJsonText(buildWidgetBundleV1({ registryEntries: registryForType, graphData: graph }))
  }, [contentMode, graphLookupById, graphLookupEdges, widgetNodeIds, widgetRegistrySnapshot])

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
