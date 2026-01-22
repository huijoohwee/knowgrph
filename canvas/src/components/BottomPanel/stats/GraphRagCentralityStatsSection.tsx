import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { AutoHeightMiniBarChart, type MiniBarChartDatum } from '@/features/panels/views/DatasetInspectorMiniViz'
import { useGraphStore } from '@/hooks/useGraphStore'
import { runGraphRagTextPipeline } from '@/lib/graph/graphragTextPipeline'
import { useGraphRagTextCentralityConfig } from '@/components/BottomPanel/hooks/useGraphRagTextCentralityConfig'
import type { StatsUiClasses } from '@/components/BottomPanel/stats/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
      <div className={['mt-2 space-y-3', ui.uiPanelKeyValueTextSizeClass, ui.uiPanelTextFontClass].join(' ')}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={cfg.hits} onChange={e => update({ hits: e.target.checked })} />
            <span>HITS (Hubs/Authorities)</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={cfg.closeness} onChange={e => update({ closeness: e.target.checked })} />
            <span>Closeness</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={cfg.pagerank} onChange={e => update({ pagerank: e.target.checked })} />
            <span>PageRank</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={cfg.betweenness} onChange={e => update({ betweenness: e.target.checked })} />
            <span>Betweenness</span>
          </label>
          <button
            type="button"
            className={[
              ui.uiPanelMicroLabelTextSizeClass,
              ui.uiPanelTextFontClass,
              'px-2 py-[2px] rounded border',
              UI_THEME_TOKENS.panel.border,
              UI_THEME_TOKENS.button.text,
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
              'px-2 py-[2px] rounded border',
              UI_THEME_TOKENS.panel.border,
              canRecompute ? UI_THEME_TOKENS.button.text : 'text-gray-400',
            ].join(' ')}
            onClick={recompute}
          >
            Recompute
          </button>
        </div>

        {selected && (
          <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-2`}>
            <div className="font-semibold text-gray-700">Selected Node</div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="text-gray-500">Label</div>
              <div className="text-gray-800">{selected.label}</div>
              <div className="text-gray-500">keyword:frequency</div>
              <div className="text-gray-800">{selected.freq}</div>
              {cfg.pagerank && (
                <>
                  <div className="text-gray-500">graphrag:pagerank</div>
                  <div className="text-gray-800">{selected.pagerank.toFixed(3)}</div>
                </>
              )}
              {cfg.hits && (
                <>
                  <div className="text-gray-500">graphrag:authorities</div>
                  <div className="text-gray-800">{selected.authorities.toFixed(3)}</div>
                  <div className="text-gray-500">graphrag:hubs</div>
                  <div className="text-gray-800">{selected.hubs.toFixed(3)}</div>
                </>
              )}
              {cfg.closeness && (
                <>
                  <div className="text-gray-500">graphrag:closeness</div>
                  <div className="text-gray-800">{selected.closeness.toFixed(3)}</div>
                </>
              )}
              {cfg.betweenness && (
                <>
                  <div className="text-gray-500">graphrag:betweenness</div>
                  <div className="text-gray-800">{selected.betweenness.toFixed(3)}</div>
                </>
              )}
            </div>
          </div>
        )}

        {cfg.pagerank && prTop.length > 0 && (
          <div className="space-y-1">
            <div className="font-semibold text-gray-700">Top PageRank</div>
            <AutoHeightMiniBarChart
              data={makeChart(prTop, 'pagerank')}
              defaultBarColor={neutralBarColor}
              containerClassName="h-12"
            />
          </div>
        )}

        {cfg.hits && authTop.length > 0 && (
          <div className="space-y-1">
            <div className="font-semibold text-gray-700">Top Authorities</div>
            <AutoHeightMiniBarChart
              data={makeChart(authTop, 'authorities')}
              defaultBarColor={neutralBarColor}
              containerClassName="h-12"
            />
          </div>
        )}

        {cfg.closeness && closeTop.length > 0 && (
          <div className="space-y-1">
            <div className="font-semibold text-gray-700">Top Closeness</div>
            <AutoHeightMiniBarChart
              data={makeChart(closeTop, 'closeness')}
              defaultBarColor={neutralBarColor}
              containerClassName="h-12"
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

