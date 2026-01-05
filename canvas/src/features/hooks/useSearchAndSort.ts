import { useMemo, useCallback } from 'react'
import { searchNodes, searchEdges } from '@/features/search'
import { sortBy, nextToggleNodeSort, nextToggleEdgeSort, type NodeSort, type EdgeSort } from '@/components/BottomPanel/sort'
import { normalized, jsonStr } from '@/features/bottom-panel/utils'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'

type SortableEdge = GraphEdge & {
  source?: string | { id?: string }
  target?: string | { id?: string }
}

const getEndpointId = (edge: SortableEdge, key: 'source' | 'target'): string => {
  const value = edge[key]
  if (typeof value === 'string') return value
  if (value && typeof (value as { id?: unknown }).id === 'string') {
    return String((value as { id: string }).id)
  }
  return ''
}

export function useSearchAndSort(
  nodes: GraphNode[],
  edges: SortableEdge[],
  query: string,
  nodeSort: NodeSort,
  setNodeSort: (s: NodeSort | ((prev: NodeSort) => NodeSort)) => void,
  edgeSort: EdgeSort,
  setEdgeSort: (s: EdgeSort | ((prev: EdgeSort) => EdgeSort)) => void,
) {
  const graphData: GraphData = useMemo(
    () => ({
      context: '',
      type: 'Graph',
      nodes,
      edges,
    }),
    [nodes, edges],
  )

  const filteredNodes = useMemo(() => {
    const q = normalized(query).trim()
    if (!q) return nodes
    const results = searchNodes(graphData, q, nodes.length)
    const ids = new Set(results.map(r => r.id))
    return nodes.filter(n => ids.has(n.id))
  }, [nodes, query, graphData])

  const filteredEdges = useMemo(() => {
    const q = normalized(query).trim()
    if (!q) return edges
    const results = searchEdges(graphData, q, edges.length)
    const ids = new Set(results.map(r => r.id))
    return edges.filter(e => ids.has(e.id))
  }, [edges, query, graphData])

  const sortedNodes = useMemo(() => {
    if (!nodeSort) return filteredNodes
    const { key, dir } = nodeSort
    if (key === 'properties') return sortBy(filteredNodes, n => jsonStr(n.properties), dir)
    return sortBy(filteredNodes, n => normalized(String(n[key] ?? '')), dir)
  }, [filteredNodes, nodeSort])

  const sortedEdges = useMemo(() => {
    if (!edgeSort) return filteredEdges
    const { key, dir } = edgeSort
    if (key === 'properties') return sortBy(filteredEdges, e => jsonStr(e.properties), dir)
    if (key === 'source') return sortBy(filteredEdges, e => normalized(getEndpointId(e, 'source')), dir)
    if (key === 'target') return sortBy(filteredEdges, e => normalized(getEndpointId(e, 'target')), dir)
    return sortBy(filteredEdges, e => normalized(String(e[key] ?? '')), dir)
  }, [filteredEdges, edgeSort])

  const toggleNodeSort = useCallback(
    (key: 'id' | 'label' | 'type' | 'properties') => {
      setNodeSort(prev => nextToggleNodeSort(prev, key))
    },
    [setNodeSort],
  )

  const toggleEdgeSort = useCallback(
    (key: 'id' | 'source' | 'target' | 'label' | 'properties') => {
      setEdgeSort(prev => nextToggleEdgeSort(prev, key))
    },
    [setEdgeSort],
  )

  return { filteredNodes, filteredEdges, sortedNodes, sortedEdges, toggleNodeSort, toggleEdgeSort }
}
