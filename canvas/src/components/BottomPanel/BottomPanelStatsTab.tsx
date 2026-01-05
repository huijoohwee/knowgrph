import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import DatasetInspectorSection from '@/features/panels/views/DatasetInspectorSection'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveGraphDataForLayers } from '@/lib/graph/layerDerivation'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'
import { buildSelectionSubgraphForAnchorIds } from '@/lib/graph/file'
import { buildNodeGroupsFromSchema, getPolygonStyleForGroup } from '@/components/GraphCanvas/polygons'
import { getNodeBaseFill } from '@/components/GraphCanvas/helpers'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { getRendererPalette, type GraphSchema } from '@/lib/graph/schema'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { getAgenticRagContextComparison, getAgenticRagIgnoreFiltersSummary } from '@/lib/graph/jsonld'
import { LS_KEYS } from '@/lib/config'
import CommunitiesStatsSection from '@/components/BottomPanel/stats/CommunitiesStatsSection'
import EdgesStatsSection from '@/components/BottomPanel/stats/EdgesStatsSection'
import NodeWordFrequenciesSection from '@/components/BottomPanel/stats/NodeWordFrequenciesSection'
import PolygonWordFrequenciesSection from '@/components/BottomPanel/stats/PolygonWordFrequenciesSection'
import {
  buildTokenFrequenciesForNodes,
  getEdgeWeightForStats,
  getStatsTokenizationConfig,
  topTokenList,
} from '@/components/BottomPanel/BottomPanelStatsUtils'
import type {
  SelectionSnapshot,
  StatsCommunity,
  StatsUiClasses,
  TokensByPolygonRow,
  TokensForSelectedNode,
  TokensForSelectedNodes,
} from '@/components/BottomPanel/stats/types'

export default function BottomPanelStatsTab() {
  const data = useGraphStore(s => s.graphData)
  const schema = useGraphStore(s => s.schema) as GraphSchema
  const zoomK = useGraphStore(s => s.zoomState?.k ?? 1)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds || [])
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds || [])

  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )

  const getStatsChartWidthPx = React.useCallback((barCount: number) => {
    const count = Number.isFinite(barCount) ? Math.max(0, Math.floor(barCount)) : 0
    if (count <= 0) return 140
    return Math.max(140, count * 4)
  }, [])

  const derivedGraph = React.useMemo(
    () => deriveGraphDataForLayers(data as GraphData | null, schema),
    [data, schema],
  )

  const polygonSelectionSnapshotRef = React.useRef<SelectionSnapshot | null>(null)
  const edgeSelectionSnapshotRef = React.useRef<SelectionSnapshot | null>(null)
  const communitySelectionSnapshotRef = React.useRef<SelectionSnapshot | null>(null)

  const [pinnedPolygonId, setPinnedPolygonId] = React.useState<string | null>(null)
  const [pinnedEdgeId, setPinnedEdgeId] = React.useState<string | null>(null)
  const [pinnedCommunityId, setPinnedCommunityId] = React.useState<number | null>(null)

  const selectionInputsForStats = React.useMemo(() => {
    const snap =
      pinnedPolygonId != null
        ? polygonSelectionSnapshotRef.current
        : pinnedEdgeId != null
          ? edgeSelectionSnapshotRef.current
          : pinnedCommunityId != null
            ? communitySelectionSnapshotRef.current
            : null
    if (snap) return snap
    return { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds }
  }, [pinnedCommunityId, pinnedEdgeId, pinnedPolygonId, selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])

  const selectionSubgraph = React.useMemo<GraphData | null>(() => {
    const graph = derivedGraph as GraphData | null
    if (!graph) return null
    const selectionAnchorIds = normalizeSelectionIds({
      selectedNodeId: selectionInputsForStats.selectedNodeId,
      selectedEdgeId: selectionInputsForStats.selectedEdgeId,
      selectedNodeIds: selectionInputsForStats.selectedNodeIds,
      selectedEdgeIds: selectionInputsForStats.selectedEdgeIds,
    })
    if (selectionAnchorIds.selectionNodeIds.length === 0 && selectionAnchorIds.selectionEdgeIds.length === 0) {
      return null
    }
    return buildSelectionSubgraphForAnchorIds(graph, selectionAnchorIds)
  }, [derivedGraph, selectionInputsForStats])

  const hasSelectionSubgraph = !!(
    selectionSubgraph &&
    Array.isArray(selectionSubgraph.nodes) &&
    selectionSubgraph.nodes.length > 0 &&
    Array.isArray(selectionSubgraph.edges)
  )

  const [statsScope, setStatsScope] = React.useState<'auto' | 'dataset' | 'selection'>('auto')
  const [statsLod, setStatsLod] = React.useState<'auto' | 'low' | 'medium' | 'high'>('auto')

  const effectiveGraphCandidate = React.useMemo<GraphData | null>(() => {
    const graph = derivedGraph as GraphData | null
    if (!graph) return null
    if (statsScope === 'dataset') return graph
    if (statsScope === 'selection') return selectionSubgraph && hasSelectionSubgraph ? selectionSubgraph : graph
    if (statsScope === 'auto' && hasSelectionSubgraph && selectionSubgraph) return selectionSubgraph
    return graph
  }, [derivedGraph, hasSelectionSubgraph, selectionSubgraph, statsScope])
  const effectiveGraph = effectiveGraphCandidate

  const effectiveLod: 'low' | 'medium' | 'high' = React.useMemo(() => {
    if (statsLod === 'low' || statsLod === 'medium' || statsLod === 'high') return statsLod
    if (zoomK < 0.7) return 'low'
    if (zoomK < 1.5) return 'medium'
    return 'high'
  }, [statsLod, zoomK])

  const maxListItems = effectiveLod === 'low' ? 10 : effectiveLod === 'medium' ? 20 : 50

  const [statsExcludeTokens, setStatsExcludeTokens] = React.useState<string[]>([])
  const [statsIncludeTokens, setStatsIncludeTokens] = React.useState<string[]>([])
  const [statsFilterMode, setStatsFilterMode] = React.useState<'exclude' | 'include'>('include')
  const [polygonTokenFilter, setPolygonTokenFilter] = React.useState<string>('')
  const [polygonTokenSort, setPolygonTokenSort] = React.useState<'freq' | 'alpha'>('freq')
  const [communityTokenFilter, setCommunityTokenFilter] = React.useState<string>('')
  const [communityTokenSort, setCommunityTokenSort] = React.useState<'freq' | 'alpha'>('freq')

  const captureSelectionSnapshot = React.useCallback(() => {
    const st = useGraphStore.getState()
    return {
      selectedNodeId: st.selectedNodeId,
      selectedEdgeId: st.selectedEdgeId,
      selectedNodeIds: st.selectedNodeIds || [],
      selectedEdgeIds: st.selectedEdgeIds || [],
    }
  }, [])

  const restoreSelectionSnapshot = React.useCallback((snap: SelectionSnapshot | null) => {
    if (!snap) return
    useGraphStore.setState({
      selectedNodeId: snap.selectedNodeId,
      selectedEdgeId: snap.selectedEdgeId,
      selectedNodeIds: snap.selectedNodeIds,
      selectedEdgeIds: snap.selectedEdgeIds,
    })
  }, [])

  const selectNodeIds = React.useCallback((nodeIds: string[]) => {
    const unique = Array.from(new Set((nodeIds || []).map(String))).filter(Boolean)
    const active = unique.length ? unique[0] : null
    const st = useGraphStore.getState()
    st.setSelectionSource('table')
    useGraphStore.setState({
      selectedNodeId: active,
      selectedEdgeId: null,
      selectedNodeIds: unique,
      selectedEdgeIds: [],
    })
  }, [])

  const selectEdgeIds = React.useCallback((edgeIds: string[]) => {
    const unique = Array.from(new Set((edgeIds || []).map(String))).filter(Boolean)
    const active = unique.length ? unique[0] : null
    const st = useGraphStore.getState()
    st.setSelectionSource('table')
    useGraphStore.setState({
      selectedNodeId: null,
      selectedEdgeId: active,
      selectedNodeIds: [],
      selectedEdgeIds: unique,
    })
  }, [])

  const datasetStats = React.useMemo(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return { nodeCount: 0, edgeCount: 0, distinctTriples: 0 }
    }
    const nodeCount = graph.nodes.length
    const edgeCount = graph.edges.length
    const triples = new Set<string>()
    graph.edges.forEach(e => {
      const s = String(e.source)
      const t = String(e.target)
      const l = String(e.label ?? '')
      triples.add(`${s}|${l}|${t}`)
    })
    return { nodeCount, edgeCount, distinctTriples: triples.size }
  }, [effectiveGraph])

  const agenticContext = React.useMemo(
    () => getAgenticRagContextComparison(data as GraphData | null),
    [data],
  )
  const datasetIgnoreFilters = React.useMemo(
    () => getAgenticRagIgnoreFiltersSummary(data as GraphData | null),
    [data],
  )

  const semanticCfg = schema.layers?.semantic || {}
  const similarityEdgeLabel = String(semanticCfg.similarityEdgeLabel || 'semanticSimilarity')
  const similarityMetricLabel = semanticCfg.similarityMetric === 'pmi' ? 'PMI' : 'Cosine'
  const baseTokenCfg = React.useMemo(
    () => getStatsTokenizationConfig(schema),
    [schema],
  )
  const tokenCfg = React.useMemo(() => {
    const base = baseTokenCfg
    const extra = new Set(base.stopwords)
    for (let i = 0; i < statsExcludeTokens.length; i += 1) {
      const t = statsExcludeTokens[i]
      const v = String(t || '').toLowerCase()
      if (!v) continue
      extra.add(v)
    }
    const includeTokens: string[] = []
    for (let i = 0; i < statsIncludeTokens.length; i += 1) {
      const t = statsIncludeTokens[i]
      const v = String(t || '').toLowerCase()
      if (!v) continue
      extra.delete(v)
      includeTokens.push(v)
    }
    const includeSet =
      statsFilterMode === 'include' && includeTokens.length > 0 ? new Set<string>(includeTokens) : null
    return {
      textKeys: base.textKeys,
      minTokenLength: base.minTokenLength,
      maxTokensPerNode: base.maxTokensPerNode,
      stopwords: extra as ReadonlySet<string>,
      includeTokens: includeSet,
    }
  }, [baseTokenCfg, statsExcludeTokens, statsFilterMode, statsIncludeTokens])

  const toggleStatsStopword = React.useCallback((token: string) => {
    const t = String(token || '').toLowerCase()
    if (!t) return
    if (statsFilterMode === 'include') {
      setStatsIncludeTokens(prev => {
        const exists = prev.includes(t)
        if (exists) return prev.filter(x => x !== t)
        return [...prev, t]
      })
      setStatsExcludeTokens(prev => prev.filter(x => x !== t))
      return
    }
    setStatsExcludeTokens(prev => {
      const exists = prev.includes(t)
      if (exists) return prev.filter(x => x !== t)
      return [...prev, t]
    })
    setStatsIncludeTokens(prev => prev.filter(x => x !== t))
  }, [statsFilterMode])

  const currentSelectionSets = React.useMemo(() => {
    const { selectionNodeIds, selectionEdgeIds } = normalizeSelectionIds({
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    })
    return {
      selectedNodeIdSet: new Set<string>(selectionNodeIds.map(String)),
      selectedEdgeIdSet: new Set<string>(selectionEdgeIds.map(String)),
    }
  }, [selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])

  const allTokensForStats = React.useMemo(() => {
    const graph = data as GraphData | null
    if (!graph || !Array.isArray(graph.nodes)) return []
    const nodes = graph.nodes as GraphNode[]
    const cfgNoStopwords: ReturnType<typeof getStatsTokenizationConfig> = {
      textKeys: baseTokenCfg.textKeys,
      minTokenLength: baseTokenCfg.minTokenLength,
      maxTokensPerNode: baseTokenCfg.maxTokensPerNode,
      stopwords: new Set<string>(),
    }
    const { freqByToken } = buildTokenFrequenciesForNodes(nodes, cfgNoStopwords)
    return topTokenList(freqByToken, freqByToken.size)
  }, [baseTokenCfg, data])

  const tokensByPolygon = React.useMemo<TokensByPolygonRow[]>(() => {
    const graphData = effectiveGraph as GraphData | null
    if (!graphData || !Array.isArray(graphData.nodes)) return []
    const nodes = graphData.nodes as GraphNode[]
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      nodeById.set(String(n.id), n)
    }
    const groups = buildNodeGroupsFromSchema(graphData, schema)
    if (!groups.length) return []
    const rows: Array<{
      polygonId: string
      label: string
      fill: string
      nodeCount: number
      nodeIds: string[]
      totalTokens: number
      topTokens: Array<{ token: string; count: number }>
    }> = []
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i]
      const memberNodes: GraphNode[] = []
      const memberIds: string[] = []
      for (let j = 0; j < group.memberIds.length; j += 1) {
        const id = String(group.memberIds[j])
        const node = nodeById.get(id)
        if (!node) continue
        memberNodes.push(node)
        memberIds.push(id)
      }
      if (!memberNodes.length) continue
      const { totalTokens, freqByToken } = buildTokenFrequenciesForNodes(memberNodes, tokenCfg)
      const topTokens = topTokenList(freqByToken, maxListItems)
      const label = (() => {
        const id = String(group.id || '')
        const ownerId = group.meta && group.meta.ownerId ? String(group.meta.ownerId) : ''
        const propertyKey = group.meta && group.meta.propertyKey ? String(group.meta.propertyKey) : ''
        const ownerNode = ownerId ? nodeById.get(ownerId) || null : null
        const ownerLabel = ownerNode && ownerNode.label ? String(ownerNode.label) : ''
        if (ownerLabel && propertyKey) return `${ownerLabel} • ${propertyKey}`
        if (ownerLabel) return ownerLabel
        if (propertyKey) return propertyKey
        if (id) return id
        return `Polygon ${rows.length + 1}`
      })()
      const fill = getPolygonStyleForGroup({ group, graphData, schema }).fill
      rows.push({
        polygonId: String(group.id || ''),
        label,
        fill,
        nodeCount: memberNodes.length,
        nodeIds: memberIds,
        totalTokens,
        topTokens,
      })
    }
    rows.sort((a, b) => {
      const diff = b.totalTokens - a.totalTokens
      if (diff !== 0) return diff
      return a.label.localeCompare(b.label)
    })
    return rows
  }, [effectiveGraph, maxListItems, schema, tokenCfg])

  const polygonTokensForDropdown = React.useMemo(() => {
    let items = allTokensForStats
    if (polygonTokenFilter) {
      const needle = polygonTokenFilter.toLowerCase()
      items = items.filter(t => t.token.toLowerCase().includes(needle))
    }
    if (polygonTokenSort === 'alpha') {
      const copy = items.slice()
      copy.sort((a, b) => a.token.localeCompare(b.token))
      return copy
    }
    return items
  }, [allTokensForStats, polygonTokenFilter, polygonTokenSort])

  const communityTokensForDropdown = React.useMemo(() => {
    let items = allTokensForStats
    if (communityTokenFilter) {
      const needle = communityTokenFilter.toLowerCase()
      items = items.filter(t => t.token.toLowerCase().includes(needle))
    }
    if (communityTokenSort === 'alpha') {
      const copy = items.slice()
      copy.sort((a, b) => a.token.localeCompare(b.token))
      return copy
    }
    return items
  }, [allTokensForStats, communityTokenFilter, communityTokenSort])

  const tokensForSelectedNode = React.useMemo<TokensForSelectedNode | null>(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || !selectedNodeId) return null
    const node = (graph.nodes as GraphNode[]).find(n => String(n.id) === String(selectedNodeId)) || null
    if (!node) return null
    const { totalTokens, freqByToken } = buildTokenFrequenciesForNodes([node], tokenCfg)
    return { node, totalTokens, topTokens: topTokenList(freqByToken, maxListItems) }
  }, [effectiveGraph, maxListItems, selectedNodeId, tokenCfg])

  const tokensForSelectedNodes = React.useMemo<TokensForSelectedNodes | null>(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.nodes)) return null
    const ids = new Set<string>([...(selectedNodeIds || []), ...(selectedNodeId ? [selectedNodeId] : [])].map(String))
    if (ids.size === 0) return null
    const nodes = (graph.nodes as GraphNode[]).filter(n => ids.has(String(n.id)))
    if (nodes.length === 0) return null
    const { totalTokens, freqByToken } = buildTokenFrequenciesForNodes(nodes, tokenCfg)
    return { nodeCount: nodes.length, totalTokens, topTokens: topTokenList(freqByToken, maxListItems) }
  }, [effectiveGraph, maxListItems, selectedNodeId, selectedNodeIds, tokenCfg])

  const semanticEdges = React.useMemo(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.edges)) return []
    const edges = graph.edges as GraphEdge[]
    return edges.filter((e) => {
      if (String(e.label ?? '') !== similarityEdgeLabel) return false
      const meta = (e.metadata || {}) as Record<string, unknown>
      return meta.derived === true && meta.kind === 'semantic'
    })
  }, [effectiveGraph, similarityEdgeLabel])

  const selectedEdge = React.useMemo(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.edges) || !selectedEdgeId) return null
    return (graph.edges as GraphEdge[]).find(e => String(e.id) === String(selectedEdgeId)) || null
  }, [effectiveGraph, selectedEdgeId])

  const selectedEdgeTokenCounts = React.useMemo(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || !selectedEdge) return null
    const srcId = String(selectedEdge.source ?? '')
    const tgtId = String(selectedEdge.target ?? '')
    if (!srcId || !tgtId) return null
    const nodes = graph.nodes as GraphNode[]
    const src = nodes.find(n => String(n.id) === srcId) || null
    const tgt = nodes.find(n => String(n.id) === tgtId) || null
    const list: GraphNode[] = []
    if (src) list.push(src)
    if (tgt && (!src || String(src.id) !== String(tgt.id))) list.push(tgt)
    if (list.length === 0) return null
    const { freqByToken } = buildTokenFrequenciesForNodes(list, tokenCfg)
    return topTokenList(freqByToken, Math.min(24, maxListItems))
  }, [effectiveGraph, maxListItems, selectedEdge, tokenCfg])

  const topSemanticEdges = React.useMemo(() => {
    const edges = semanticEdges.slice()
    edges.sort((a, b) => {
      const aw = getEdgeWeightForStats(a)
      const bw = getEdgeWeightForStats(b)
      const diff = bw - aw
      if (diff !== 0) return diff
      return String(a.id).localeCompare(String(b.id))
    })
    return edges
  }, [semanticEdges])

  const semanticEdgeColor = React.useMemo(() => {
    const byLabel = schema.edgeStyles && similarityEdgeLabel && schema.edgeStyles[similarityEdgeLabel]
      ? schema.edgeStyles[similarityEdgeLabel]?.color
      : null
    const c = typeof byLabel === 'string' ? byLabel.trim() : ''
    if (c) return c
    return getRendererPalette(schema).edges.neutral
  }, [schema, similarityEdgeLabel])

  const neutralBarColor = React.useMemo(() => {
    return getRendererPalette(schema).edges.neutral
  }, [schema])

  const communities = React.useMemo<StatsCommunity[]>(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.nodes)) return []
    const nodes = graph.nodes as GraphNode[]
    const byCommunity = new Map<number, { id: number; count: number; fill: string; nodes: GraphNode[] }>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const props = (n.properties || {}) as Record<string, unknown>
      const raw = props['visual:community']
      const c =
        typeof raw === 'number'
          ? (Number.isFinite(raw) ? raw : null)
          : (typeof raw === 'string' && raw.trim() ? Number(raw) : null)
      if (c == null || !Number.isFinite(c)) continue
      const fill = typeof props['visual:fill'] === 'string' ? String(props['visual:fill']).trim() : ''
      const existing = byCommunity.get(c)
      if (existing) {
        existing.count += 1
        if (!existing.fill && fill) existing.fill = fill
        existing.nodes.push(n)
      } else {
        byCommunity.set(c, { id: c, count: 1, fill, nodes: [n] })
      }
    }
    const list = Array.from(byCommunity.values()).map((group) => {
      const { freqByToken } = buildTokenFrequenciesForNodes(group.nodes, tokenCfg)
      const topTokens = topTokenList(freqByToken, Math.min(12, maxListItems))
      const name = topTokens.length > 0
        ? topTokens.slice(0, Math.min(2, topTokens.length)).map(t => t.token).join(' · ')
        : `Community ${String(group.id)}`
      const description = topTokens.length > 0
        ? topTokens.slice(0, Math.min(5, topTokens.length)).map(t => `${t.token}(${t.count})`).join(', ')
        : ''
      const derivedFill = group.fill || (group.nodes.length ? getNodeBaseFill(group.nodes[0], schema) : '')
      return {
        id: group.id,
        count: group.count,
        fill: derivedFill || getRendererPalette(schema).nodes.execution,
        nodeIds: group.nodes.map(n => String(n.id)),
        name,
        description,
        topTokens,
      }
    })
    list.sort((a, b) => {
      const diff = b.count - a.count
      if (diff !== 0) return diff
      return a.id - b.id
    })
    return list
  }, [effectiveGraph, maxListItems, schema, tokenCfg])

  const communityCount = communities.length
  const communityCoverage = React.useMemo(() => {
    const graph = effectiveGraph as GraphData | null
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return 0
    const covered = communities.reduce((sum, c) => sum + c.count, 0)
    return covered / graph.nodes.length
  }, [communities, effectiveGraph])

  const [datasetInspectorCollapsed, setDatasetInspectorCollapsed] = usePersistedBoolean(
    LS_KEYS.renderDatasetInspectorCollapsed,
    true,
  )

  const ui: StatsUiClasses = React.useMemo(() => {
    return {
      uiPanelMonospaceTextClass,
      uiPanelKeyValueTextSizeClass,
      uiPanelMicroLabelTextSizeClass,
      uiPanelTextFontClass,
    }
  }, [uiPanelKeyValueTextSizeClass, uiPanelMicroLabelTextSizeClass, uiPanelMonospaceTextClass, uiPanelTextFontClass])

  const clearPinnedPolygonState = React.useCallback(() => {
    setPinnedPolygonId(null)
  }, [])

  const clearPinnedEdgeState = React.useCallback(() => {
    setPinnedEdgeId(null)
  }, [])

  const clearPinnedCommunityState = React.useCallback(() => {
    setPinnedCommunityId(null)
  }, [])

  return (
    <div className="h-full min-h-0 flex flex-col overflow-auto px-3">
      <CollapsibleSection
        title="Dashboard"
        className="mt-0 border-t-0 pt-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            {(['auto', 'dataset', 'selection'] as const).map(key => (
              <button
                key={key}
                type="button"
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'px-2 py-[2px]',
                  statsScope === key ? 'bg-gray-200 text-gray-800' : 'text-gray-500',
                ].join(' ')}
                onClick={() => setStatsScope(key)}
              >
                {key === 'auto' ? 'Auto' : key === 'dataset' ? 'Dataset' : 'Selection'}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            {(['auto', 'low', 'medium', 'high'] as const).map(key => (
              <button
                key={key}
                type="button"
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'px-2 py-[2px]',
                  statsLod === key ? 'bg-gray-200 text-gray-800' : 'text-gray-500',
                ].join(' ')}
                onClick={() => setStatsLod(key)}
              >
                {key === 'auto' ? 'LOD: Auto' : key === 'low' ? 'LOD: Low' : key === 'medium' ? 'LOD: Medium' : 'LOD: High'}
              </button>
            ))}
          </div>
        </div>

        <div className={['mt-2 grid grid-cols-2 gap-3', uiPanelTextFontClass].join(' ')}>
          <div className="rounded border border-gray-200 bg-white p-3">
            <div className={[uiPanelKeyValueTextSizeClass, 'text-gray-700 font-semibold'].join(' ')}>
              Summary
            </div>
            <div className={[uiPanelKeyValueTextSizeClass, 'mt-2 grid grid-cols-2 gap-2 text-gray-700'].join(' ')}>
              <div className="flex flex-col">
                <span className="uppercase tracking-wide text-gray-500">Nodes</span>
                <span className="font-semibold">{String(datasetStats.nodeCount)}</span>
              </div>
              <div className="flex flex-col">
                <span className="uppercase tracking-wide text-gray-500">Edges</span>
                <span className="font-semibold">{String(datasetStats.edgeCount)}</span>
              </div>
              <div className="flex flex-col">
                <span className="uppercase tracking-wide text-gray-500">Semantic edges</span>
                <span className="font-semibold">{String(semanticEdges.length)}</span>
              </div>
              <div className="flex flex-col">
                <span className="uppercase tracking-wide text-gray-500">Communities</span>
                <span className="font-semibold">
                  {String(communityCount)}
                  {communityCount > 0 ? ` (${Math.round(communityCoverage * 100)}%)` : ''}
                </span>
              </div>
            </div>
            {!hasSelectionSubgraph ? null : (
              <div className={[uiPanelMicroLabelTextSizeClass, 'mt-2 text-gray-500'].join(' ')}>
                Selection subgraph detected (Auto scope will use it).
              </div>
            )}
          </div>

          <div className="rounded border border-gray-200 bg-white p-3">
            <div className={[uiPanelKeyValueTextSizeClass, 'text-gray-700 font-semibold'].join(' ')}>
              Semantic settings
            </div>
            <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-2 text-gray-600 space-y-1'].join(' ')}>
              <div>
                schema.layers.mode:{' '}
                <span className={uiPanelMonospaceTextClass}>{String(schema.layers?.mode || 'property')}</span>
              </div>
              <div>
                similarityEdgeLabel:{' '}
                <span className={uiPanelMonospaceTextClass}>{similarityEdgeLabel || 'semanticSimilarity'}</span>
              </div>
              <div>
                similarityMetric:{' '}
                <span className={uiPanelMonospaceTextClass}>{similarityMetricLabel}</span>
              </div>
              <div>
                communityDetection:{' '}
                <span className={uiPanelMonospaceTextClass}>
                  {semanticCfg.communityDetection?.enabled === false ? 'disabled' : 'enabled'}
                </span>
              </div>
              <div>
                textKeys:{' '}
                <span className={uiPanelMonospaceTextClass}>
                  {tokenCfg.textKeys.length ? tokenCfg.textKeys.join(', ') : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>
      <PolygonWordFrequenciesSection
        ui={ui}
        neutralBarColor={neutralBarColor}
        selectedNodeIdSet={currentSelectionSets.selectedNodeIdSet}
        tokensByPolygon={tokensByPolygon}
        polygonTokensForDropdown={polygonTokensForDropdown}
        polygonTokenFilter={polygonTokenFilter}
        setPolygonTokenFilter={setPolygonTokenFilter}
        polygonTokenSort={polygonTokenSort}
        setPolygonTokenSort={setPolygonTokenSort}
        statsFilterMode={statsFilterMode}
        setStatsFilterMode={setStatsFilterMode}
        statsExcludeTokens={statsExcludeTokens}
        setStatsExcludeTokens={setStatsExcludeTokens}
        statsIncludeTokens={statsIncludeTokens}
        setStatsIncludeTokens={setStatsIncludeTokens}
        toggleStatsToken={toggleStatsStopword}
        getStatsChartWidthPx={getStatsChartWidthPx}
        pinnedPolygonId={pinnedPolygonId}
        setPinnedPolygonId={setPinnedPolygonId}
        clearPinnedEdgeState={clearPinnedEdgeState}
        clearPinnedCommunityState={clearPinnedCommunityState}
        polygonSelectionSnapshotRef={polygonSelectionSnapshotRef}
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        selectNodeIds={selectNodeIds}
      />

      <NodeWordFrequenciesSection
        ui={ui}
        tokensForSelectedNodes={tokensForSelectedNodes}
        tokensForSelectedNode={tokensForSelectedNode}
        statsFilterMode={statsFilterMode}
        statsExcludeTokens={statsExcludeTokens}
        statsIncludeTokens={statsIncludeTokens}
        toggleStatsToken={toggleStatsStopword}
      />

      <EdgesStatsSection
        ui={ui}
        neutralBarColor={neutralBarColor}
        selectedEdgeIdSet={currentSelectionSets.selectedEdgeIdSet}
        similarityMetricLabel={similarityMetricLabel}
        selectedEdge={selectedEdge}
        topSemanticEdges={topSemanticEdges}
        selectedEdgeTokenCounts={selectedEdgeTokenCounts}
        pinnedEdgeId={pinnedEdgeId}
        setPinnedEdgeId={setPinnedEdgeId}
        clearPinnedPolygonState={clearPinnedPolygonState}
        clearPinnedCommunityState={clearPinnedCommunityState}
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
        polygonSelectionSnapshotRef={polygonSelectionSnapshotRef}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        selectEdgeIds={selectEdgeIds}
        getStatsChartWidthPx={getStatsChartWidthPx}
        semanticEdgeColor={semanticEdgeColor}
      />

      <CommunitiesStatsSection
        ui={ui}
        neutralBarColor={neutralBarColor}
        selectedNodeIdSet={currentSelectionSets.selectedNodeIdSet}
        communities={communities}
        communityTokensForDropdown={communityTokensForDropdown}
        communityTokenFilter={communityTokenFilter}
        setCommunityTokenFilter={setCommunityTokenFilter}
        communityTokenSort={communityTokenSort}
        setCommunityTokenSort={setCommunityTokenSort}
        statsFilterMode={statsFilterMode}
        setStatsFilterMode={setStatsFilterMode}
        statsExcludeTokens={statsExcludeTokens}
        setStatsExcludeTokens={setStatsExcludeTokens}
        statsIncludeTokens={statsIncludeTokens}
        setStatsIncludeTokens={setStatsIncludeTokens}
        toggleStatsToken={toggleStatsStopword}
        pinnedCommunityId={pinnedCommunityId}
        setPinnedCommunityId={setPinnedCommunityId}
        clearPinnedPolygonState={clearPinnedPolygonState}
        clearPinnedEdgeState={clearPinnedEdgeState}
        communitySelectionSnapshotRef={communitySelectionSnapshotRef}
        polygonSelectionSnapshotRef={polygonSelectionSnapshotRef}
        edgeSelectionSnapshotRef={edgeSelectionSnapshotRef}
        captureSelectionSnapshot={captureSelectionSnapshot}
        restoreSelectionSnapshot={restoreSelectionSnapshot}
        selectNodeIds={selectNodeIds}
        getStatsChartWidthPx={getStatsChartWidthPx}
      />

      <DatasetInspectorSection
        datasetStats={datasetStats}
        contextComparison={agenticContext}
        ignoreFilters={datasetIgnoreFilters}
        collapsed={datasetInspectorCollapsed}
        onToggle={setDatasetInspectorCollapsed}
      />
    </div>
  )
}
