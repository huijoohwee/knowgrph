import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart, type MiniBarChartDatum } from '@/features/panels/views/DatasetInspectorMiniViz'
import { useGraphStore } from '@/hooks/useGraphStore'
import { runGraphRagTextPipeline } from '@/lib/graph/graphragTextPipeline'
import { useGraphRagTextCentralityConfig } from '@/features/graphrag/hooks/useGraphRagTextCentralityConfig'
import { GraphRagCentralityToggleGroup } from '@/features/graphrag/ui/GraphRagCentralityToggleGroup'
import type { StatsUiClasses } from '@/features/graph-stats/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { GRAPH_STATS_DETAIL_GRID_CLASS_NAME } from '@/features/graph-stats/graphStatsResponsiveClasses'
import { UI_RESPONSIVE_COMPACT_INLINE_CONTROL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

const statsActionButtonClassName = `${UI_RESPONSIVE_COMPACT_INLINE_CONTROL_CLASSNAME} rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`

type CentralityRow = {
  id: string
  label: string
  pagerank: number
  authorities: number
  hubs: number
  closeness: number
  betweenness: number
  freq: number
}

const toFiniteNum = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return v
}

const readCentralityRows = (graphData: unknown): CentralityRow[] => {
  if (!graphData || typeof graphData !== 'object' || Array.isArray(graphData)) return []
  const nodes = (graphData as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes)) return []
  const out: CentralityRow[] = []
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || Array.isArray(n)) continue
    const id = String((n as { id?: unknown }).id || '')
    if (!id) continue
    const label = String((n as { label?: unknown }).label || id)
    const props = ((n as { properties?: unknown }).properties || {}) as Record<string, unknown>
    out.push({
      id,
      label,
      pagerank: toFiniteNum(props['graphrag:pagerank']),
      authorities: toFiniteNum(props['graphrag:authorities']),
      hubs: toFiniteNum(props['graphrag:hubs']),
      closeness: toFiniteNum(props['graphrag:closeness']),
      betweenness: toFiniteNum(props['graphrag:betweenness']),
      freq: toFiniteNum(props['keyword:frequency']),
    })
  }
  return out
}

const topBy = (rows: CentralityRow[], key: keyof CentralityRow, limit: number): CentralityRow[] => {
  const out = rows.slice()
  out.sort((a, b) => {
    const diff = (b[key] as number) - (a[key] as number)
    if (diff !== 0) return diff
    return a.label.localeCompare(b.label)
  })
  return out.slice(0, Math.max(0, limit))
}

const makeChart = (rows: CentralityRow[], key: keyof CentralityRow): MiniBarChartDatum[] => {
  return rows.map(r => ({
    key: r.id,
    value: r[key] as number,
    label: `${r.label}: ${(r[key] as number).toFixed(3)}`,
  }))
}

const readCurrentCentralityConfigFromGraphData = (graphData: unknown): Record<string, boolean> | null => {
  if (!graphData || typeof graphData !== 'object' || Array.isArray(graphData)) return null
  const meta = (graphData as { metadata?: unknown }).metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const pipeline = (meta as Record<string, unknown>).graphragTextPipeline
  if (!pipeline || typeof pipeline !== 'object' || Array.isArray(pipeline)) return null
  const cfg = (pipeline as Record<string, unknown>).config
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return null
  const centrality = (cfg as Record<string, unknown>).centrality
  if (!centrality || typeof centrality !== 'object' || Array.isArray(centrality)) return null
  const c = centrality as Record<string, unknown>
  const keys = ['pagerank', 'hits', 'betweenness', 'closeness']
  for (const k of keys) {
    if (typeof c[k] !== 'boolean') return null
  }
  return { pagerank: c.pagerank as boolean, hits: c.hits as boolean, betweenness: c.betweenness as boolean, closeness: c.closeness as boolean }
}

export default function GraphRagCentralityStatsSection({
  ui,
  neutralBarColor,
}: {
  ui: StatsUiClasses
  neutralBarColor: string
}) {
  const graphData = useGraphStore(s => s.graphData)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)
  const jsonSourceDocumentText = useGraphStore(s => s.jsonSourceDocumentText)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const { cfg, update, reset } = useGraphRagTextCentralityConfig()

  const isGraphRag = graphData?.context === 'graphrag-text'
  const rows = React.useMemo(() => readCentralityRows(graphData), [graphData])
  const selected = React.useMemo(() => rows.find(r => r.id === selectedNodeId) || null, [rows, selectedNodeId])

  const sourceText = React.useMemo(() => {
    const a = typeof markdownDocumentText === 'string' ? markdownDocumentText : ''
    const b = typeof jsonSourceDocumentText === 'string' ? jsonSourceDocumentText : ''
    return a.trim() ? a : b
  }, [jsonSourceDocumentText, markdownDocumentText])

  const canRecompute = isGraphRag && typeof sourceText === 'string' && sourceText.trim().length > 0
  const activeCfg = React.useMemo(() => readCurrentCentralityConfigFromGraphData(graphData), [graphData])

  const recompute = React.useCallback(() => {
    if (!canRecompute) return
    const res = runGraphRagTextPipeline(sourceText, { centrality: cfg })
    useGraphStore.getState().setGraphData(res.graphData)
  }, [canRecompute, cfg, sourceText])

  React.useEffect(() => {
    if (!canRecompute) return
    const mismatch = !activeCfg ||
      activeCfg.pagerank !== cfg.pagerank ||
      activeCfg.hits !== cfg.hits ||
      activeCfg.betweenness !== cfg.betweenness ||
      activeCfg.closeness !== cfg.closeness
    if (!mismatch) return
    recompute()
  }, [activeCfg, canRecompute, cfg, recompute])

  if (!isGraphRag) return null

  const maxBars = 16
  const prTop = cfg.pagerank ? topBy(rows, 'pagerank', maxBars) : []
  const authTop = cfg.hits ? topBy(rows, 'authorities', maxBars) : []
  const closeTop = cfg.closeness ? topBy(rows, 'closeness', maxBars) : []

  return (
    <CollapsibleSection title="Context-Aware Analytics">
      <section className={['mt-2 space-y-3', ui.uiPanelKeyValueTextSizeClass, ui.uiPanelTextFontClass].join(' ')}>
        <GraphRagCentralityToggleGroup
          cfg={cfg}
          onChange={update}
          className="text-xs"
          options={[
            { key: 'hits', label: 'HITS (Hubs/Authorities)' },
            { key: 'closeness', label: 'Closeness' },
            { key: 'pagerank', label: 'PageRank' },
            { key: 'betweenness', label: 'Betweenness' },
          ]}
          actions={(
            <>
              <button
                type="button"
                className={[
                  ui.uiPanelMicroLabelTextSizeClass,
                  ui.uiPanelTextFontClass,
                  statsActionButtonClassName,
                ].join(' ')}
                onClick={reset}
              >
                Reset
              </button>
              <button
                type="button"
                disabled={!canRecompute}
                className={[
                  ui.uiPanelMicroLabelTextSizeClass,
                  ui.uiPanelTextFontClass,
                  `${UI_RESPONSIVE_COMPACT_INLINE_CONTROL_CLASSNAME} rounded border`,
                  UI_THEME_TOKENS.panel.border,
                  canRecompute ? `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}` : UI_THEME_TOKENS.text.tertiary,
                ].join(' ')}
                onClick={recompute}
              >
                Recompute
              </button>
            </>
          )}
        />

        {selected && (
          <section className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-2`}>
            <section className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Selected Node</section>
            <section className={`mt-1 ${GRAPH_STATS_DETAIL_GRID_CLASS_NAME}`}>
              <section className={UI_THEME_TOKENS.text.tertiary}>Label</section>
              <section className={UI_THEME_TOKENS.text.primary}>{selected.label}</section>
              <section className={UI_THEME_TOKENS.text.tertiary}>keyword:frequency</section>
              <section className={UI_THEME_TOKENS.text.primary}>{selected.freq}</section>
              {cfg.pagerank && (
                <>
                  <section className={UI_THEME_TOKENS.text.tertiary}>graphrag:pagerank</section>
                  <section className={UI_THEME_TOKENS.text.primary}>{selected.pagerank.toFixed(3)}</section>
                </>
              )}
              {cfg.hits && (
                <>
                  <section className={UI_THEME_TOKENS.text.tertiary}>graphrag:authorities</section>
                  <section className={UI_THEME_TOKENS.text.primary}>{selected.authorities.toFixed(3)}</section>
                  <section className={UI_THEME_TOKENS.text.tertiary}>graphrag:hubs</section>
                  <section className={UI_THEME_TOKENS.text.primary}>{selected.hubs.toFixed(3)}</section>
                </>
              )}
              {cfg.closeness && (
                <>
                  <section className={UI_THEME_TOKENS.text.tertiary}>graphrag:closeness</section>
                  <section className={UI_THEME_TOKENS.text.primary}>{selected.closeness.toFixed(3)}</section>
                </>
              )}
              {cfg.betweenness && (
                <>
                  <section className={UI_THEME_TOKENS.text.tertiary}>graphrag:betweenness</section>
                  <section className={UI_THEME_TOKENS.text.primary}>{selected.betweenness.toFixed(3)}</section>
                </>
              )}
            </section>
          </section>
        )}

        {cfg.pagerank && prTop.length > 0 && (
          <section className="space-y-1">
            <section className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Top PageRank</section>
            <AutoHeightMiniBarChart
              data={makeChart(prTop, 'pagerank')}
              defaultBarColor={neutralBarColor}
              containerClassName="h-12"
            />
          </section>
        )}

        {cfg.hits && authTop.length > 0 && (
          <section className="space-y-1">
            <section className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Top Authorities</section>
            <AutoHeightMiniBarChart
              data={makeChart(authTop, 'authorities')}
              defaultBarColor={neutralBarColor}
              containerClassName="h-12"
            />
          </section>
        )}

        {cfg.closeness && closeTop.length > 0 && (
          <section className="space-y-1">
            <section className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Top Closeness</section>
            <AutoHeightMiniBarChart
              data={makeChart(closeTop, 'closeness')}
              defaultBarColor={neutralBarColor}
              containerClassName="h-12"
            />
          </section>
        )}
      </section>
    </CollapsibleSection>
  )
}
