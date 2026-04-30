import React from 'react'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  FLOW_WIDGET_FORM_ID_KEY,
  FLOW_WIDGET_TYPE_ID_KEY,
  resolveWidgetRegistryEntry,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { buildWidgetBundleV1, widgetBundleToJsonText } from '@/lib/graph/io/widgetBundle'

export function useMarkdownWorkspaceWidgetMode(args: {
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  graphContentRevision: number
  widgetRegistry: WidgetRegistryEntry[]
  openWidgetNodeIds: string[]
  selectedNodeId: string | null
  activePath: string | null
  isMarkdownPath: (path: string) => boolean
}) {
  const [contentMode, setContentMode] = React.useState<'document' | 'widget'>('document')
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

  const widgetNodeIds = React.useMemo(() => {
    const nodes = Array.isArray(graphNodesRef.current)
      ? (graphNodesRef.current as Array<{ id?: unknown; type?: unknown; properties?: unknown }>)
      : []
    const byId = new Map(nodes.map(node => [String(node.id || ''), node] as const))
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
        const reg = node ? resolveWidgetRegistryEntry({ node: node as never, registry: args.widgetRegistry }) : null
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

    for (let i = args.openWidgetNodeIds.length - 1; i >= 0; i -= 1) {
      const id = String(args.openWidgetNodeIds[i] || '').trim()
      if (!id || seen.has(id)) continue
      const node = byId.get(id) || null
      if (!node || isHeadingSectionNode(node)) continue
      seen.add(id)
      collected.push(id)
    }
    return collected.reverse()
  }, [args.graphContentRevision, args.openWidgetNodeIds, args.selectedNodeId, args.widgetRegistry])

  const widgetAvailable = widgetNodeIds.length > 0

  React.useEffect(() => {
    if (contentMode === 'widget' && !widgetAvailable) setContentModeAuto('document')
  }, [contentMode, setContentModeAuto, widgetAvailable])

  React.useEffect(() => {
    if (!widgetAvailable || contentMode === 'widget' || userForcedDocumentRef.current) return
    if (args.isMarkdownPath(String(args.activePath || ''))) return
    setContentModeAuto('widget')
  }, [args.activePath, args.isMarkdownPath, contentMode, setContentModeAuto, widgetAvailable])

  const widgetBundleJsonText = React.useMemo(() => {
    if (widgetNodeIds.length === 0) return ''
    const nodes = Array.isArray(graphNodesRef.current) ? graphNodesRef.current : []
    const edges = Array.isArray(graphEdgesRef.current) ? graphEdgesRef.current : []
    const widgetNodeIdSet = new Set(widgetNodeIds)
    const widgetNodes = widgetNodeIds
      .map(id => nodes.find(node => String(node.id || '') === id) || null)
      .filter((node): node is GraphNode => !!node)
    if (widgetNodes.length === 0) return ''

    const registryNodeTypeIds = new Set(widgetNodes.map(node => String(node.type || '').trim()).filter(Boolean))
    const registryForType = (args.widgetRegistry || []).filter(entry => {
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
  }, [args.graphContentRevision, args.widgetRegistry, widgetNodeIds])

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
