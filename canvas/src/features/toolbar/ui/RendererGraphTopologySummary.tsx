import React from 'react'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { readGraphTopologySummary, withGraphTopologyMetadata, type GraphTopologySummary } from '@/lib/graph/graphTopology'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const formatCount = (value: unknown): string => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number(value)
  if (!Number.isFinite(n)) return '0'
  return Math.floor(n).toLocaleString()
}

const readNumber = (record: Record<string, unknown>, key: string): number => {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
  }
  return 0
}

const compactCounts = (items: GraphTopologySummary['topEdgeLabels']): string => {
  const text = items
    .slice(0, 4)
    .map(item => `${item.value} ${formatCount(item.count)}`)
    .join(' | ')
  return text || 'none'
}

export function RendererGraphTopologySummary() {
  const graphData = useActiveGraphRenderData()
  const topologyGraph = React.useMemo(() => {
    if (!graphData) return null
    if (readGraphTopologySummary(graphData)) return graphData
    return withGraphTopologyMetadata({ graphData, stage: 'renderer-panel', annotate: false })
  }, [graphData])
  const summary = readGraphTopologySummary(topologyGraph)
  const metadata = (topologyGraph?.metadata && typeof topologyGraph.metadata === 'object' && !Array.isArray(topologyGraph.metadata))
    ? (topologyGraph.metadata as Record<string, unknown>)
    : {}
  const prunedNodes = readNumber(metadata, 'canvasRenderNodePrunedCount')
  const prunedEdges = readNumber(metadata, 'canvasRenderEdgePrunedCount')

  if (!summary) return null

  return (
    <section className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} px-2 py-2`} aria-label="Graph topology">
      <div className={`mb-2 text-xs font-semibold ${UI_THEME_TOKENS.button.text}`}>Graph topology</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className={UI_THEME_TOKENS.text.tertiary}>Nodes</span>
          <span className={UI_THEME_TOKENS.text.primary}>{formatCount(summary.nodeCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={UI_THEME_TOKENS.text.tertiary}>Edges</span>
          <span className={UI_THEME_TOKENS.text.primary}>{formatCount(summary.edgeCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={UI_THEME_TOKENS.text.tertiary}>Connected</span>
          <span className={UI_THEME_TOKENS.text.primary}>{formatCount(summary.connectedNodeCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={UI_THEME_TOKENS.text.tertiary}>Structural</span>
          <span className={UI_THEME_TOKENS.text.primary}>{formatCount(summary.structuralEdgeCount)}</span>
        </div>
        {(prunedNodes > 0 || prunedEdges > 0) ? (
          <div className={`col-span-2 flex items-center justify-between gap-2 ${UI_THEME_TOKENS.text.secondary}`}>
            <span>Pruned</span>
            <span>{formatCount(prunedNodes)} nodes / {formatCount(prunedEdges)} edges</span>
          </div>
        ) : null}
      </div>
      <div className={`mt-2 text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}>
        Types: {compactCounts(summary.topNodeTypes)}
      </div>
      <div className={`mt-1 text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}>
        Labels: {compactCounts(summary.topEdgeLabels)}
      </div>
    </section>
  )
}
