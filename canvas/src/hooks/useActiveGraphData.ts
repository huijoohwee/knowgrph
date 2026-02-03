import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import type { GraphData } from '@/lib/graph/types'
import { keywordGraphCache, deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'
import { hashText } from '@/features/parsers/hash'
import { hasNodeMedia } from '@/components/GraphCanvas/helpers'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'

const buildKeywordSourceTextFromGraph = (graph: GraphData): string => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const parts: string[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const label = String(nodes[i]?.label || '').trim()
    if (!label) continue
    parts.push(label)
  }
  return parts.join('\n')
}

export const mergeKeywordGraphWithMediaNodes = (args: {
  baseGraphData: GraphData
  keywordGraph: GraphData
  sourceId: string
}): GraphData => {
  const mediaNodes = (() => {
    const nodes = Array.isArray(args.baseGraphData.nodes) ? args.baseGraphData.nodes : []
    const out: typeof nodes = []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (!n) continue
      if (!hasNodeMedia(n)) continue
      out.push(n)
    }
    return out
  })()
  if (mediaNodes.length === 0) return args.keywordGraph
  const existingIds = new Set<string>((args.keywordGraph.nodes || []).map(n => String(n.id)))
  const mergedMedia = mediaNodes
    .filter(n => !existingIds.has(String(n.id)))
    .map(n => ({
      ...n,
      properties: { ...(n.properties || {}) },
      metadata: { ...(n.metadata || {}), derived: true, kind: 'keyword:media', source: args.sourceId },
    }))
  if (mergedMedia.length === 0) return args.keywordGraph
  return { ...args.keywordGraph, nodes: [...(args.keywordGraph.nodes || []), ...mergedMedia] }
}

export function useActiveGraphData(): GraphData | null {
  const { baseGraphData, mode, markdownName, markdownText, revision } = useGraphStore(
    useShallow(s => ({
      baseGraphData: s.graphData as GraphData | null,
      mode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      markdownName: s.markdownDocumentName || null,
      markdownText: s.markdownDocumentText || null,
      revision: s.graphDataRevision || 0,
    })),
  )

  return React.useMemo(() => {
    if (!baseGraphData) return null
    if (mode !== 'keyword') return baseGraphData
    const sourceText = typeof markdownText === 'string' && markdownText.trim()
      ? markdownText
      : buildKeywordSourceTextFromGraph(baseGraphData)
    const docId = markdownName && markdownName.trim()
      ? `md:${hashText(markdownName.trim())}`
      : `graph:${hashText(String(revision))}`
    const cacheKey = `keyword:${docId}:${hashText(sourceText)}`
    const cached = keywordGraphCache.get(cacheKey)
    if (cached) {
      return mergeKeywordGraphWithMediaNodes({ baseGraphData, keywordGraph: cached.graph, sourceId: docId })
    }
    const derived = deriveKeywordGraphFromText({ documentId: docId, documentText: sourceText, sourceLabel: markdownName || undefined })
    const graph = mergeKeywordGraphWithMediaNodes({ baseGraphData, keywordGraph: derived.graph, sourceId: docId })
    keywordGraphCache.set(cacheKey, { ...derived, graph })
    return graph
  }, [baseGraphData, markdownName, markdownText, mode, revision])
}

export function deriveGraphDataForActiveView(args: {
  graphData: GraphData
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  collapsedGroupIds: string[]
}): GraphData {
  const base =
    args.frontmatterModeEnabled && String(args.documentSemanticMode) !== 'keyword'
      ? filterGraphToFrontmatterMermaid(args.graphData)
      : args.graphData

  const collapsedGroupIds = Array.isArray(args.collapsedGroupIds) ? args.collapsedGroupIds : []
  if (collapsedGroupIds.length === 0) return base
  return deriveGraphDataWithGroupCollapse({ graphData: base, collapsedGroupIds })
}

export function useActiveGraphRenderData(): GraphData | null {
  const graphData = useActiveGraphData()
  const { frontmatterModeEnabled, documentSemanticMode, collapsedGroupIds } = useGraphStore(
    useShallow(s => ({
      frontmatterModeEnabled: s.frontmatterModeEnabled === true,
      documentSemanticMode: String(s.documentSemanticMode || 'document'),
      collapsedGroupIds: (s.collapsedGroupIds || []) as string[],
    })),
  )

  const collapsedGroupIdsKey = React.useMemo(() => {
    const ids = Array.isArray(collapsedGroupIds) ? collapsedGroupIds : []
    const normalized = ids.map(x => String(x || '').trim()).filter(Boolean)
    if (normalized.length === 0) return ''
    normalized.sort((a, b) => a.localeCompare(b))
    return normalized.join('|')
  }, [collapsedGroupIds])

  return React.useMemo(() => {
    if (!graphData) return null
    if (!frontmatterModeEnabled && !collapsedGroupIdsKey) return graphData
    const normalizedCollapsedGroupIds = collapsedGroupIdsKey ? collapsedGroupIdsKey.split('|').filter(Boolean) : []
    return deriveGraphDataForActiveView({
      graphData,
      frontmatterModeEnabled,
      documentSemanticMode,
      collapsedGroupIds: normalizedCollapsedGroupIds,
    })
  }, [collapsedGroupIdsKey, documentSemanticMode, frontmatterModeEnabled, graphData])
}
