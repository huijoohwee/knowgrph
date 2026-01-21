import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import type { GraphData } from '@/lib/graph/types'
import { keywordGraphCache, deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'
import { hashText } from '@/features/parsers/hash'

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
    if (cached) return cached.graph
    const derived = deriveKeywordGraphFromText({ documentId: docId, documentText: sourceText, sourceLabel: markdownName || undefined })
    keywordGraphCache.set(cacheKey, derived)
    return derived.graph
  }, [baseGraphData, markdownName, markdownText, mode, revision])
}
