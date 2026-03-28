import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'

function ToggleRow(props: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  return (
    <div className="flex items-center gap-2">
      <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
        {props.label}
      </label>
      <div className="w-[50%] flex items-center gap-1 justify-end">
        <button
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${!props.value ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={() => props.onChange(false)}
        >
          Off
        </button>
        <button
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${props.value ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={() => props.onChange(true)}
        >
          On
        </button>
      </div>
    </div>
  )
}

function NumberRow(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueInputClass = useGraphStore(
    s => s.uiPanelKeyValueInputClass || `w-full h-6 px-2 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded text-right`,
  )
  return (
    <div className="flex items-center gap-2">
      <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
        {props.label}
      </label>
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={typeof props.step === 'number' ? props.step : 1}
        value={props.value}
        onChange={e => {
          const raw = Number.parseFloat(e.target.value)
          if (!Number.isFinite(raw)) return
          props.onChange(Math.max(props.min, Math.min(props.max, raw)))
        }}
        className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[50%] text-right`}
      />
    </div>
  )
}

function SelectRow(props: { label: string; value: string; options: string[]; onChange: (next: string) => void }) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  return (
    <div className="flex items-center gap-2">
      <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
        {props.label}
      </label>
      <select
        className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[50%]`}
        value={props.value}
        onChange={e => props.onChange(String(e.target.value || ''))}
      >
        {props.options.map(o => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

export function BipartiteRendererSettings() {
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')

  const {
    dataSource,
    setDataSource,
    pollIntervalSec,
    setPollIntervalSec,
    nodeSizeMetric,
    setNodeSizeMetric,
    nodeGlowMetric,
    setNodeGlowMetric,
    nodePulseMetric,
    setNodePulseMetric,
    nodeBorderMetric,
    setNodeBorderMetric,
    edgeOpacityMetric,
    setEdgeOpacityMetric,
    showBadges,
    setShowBadges,
    showGapScore,
    setShowGapScore,
    showClusterGap,
    setShowClusterGap,
  } = useGraphStore(
    useShallow(s => ({
      dataSource: s.bipartiteDataSource,
      setDataSource: s.setBipartiteDataSource,
      pollIntervalSec: s.bipartitePollIntervalSec,
      setPollIntervalSec: s.setBipartitePollIntervalSec,
      nodeSizeMetric: s.bipartiteNodeSizeMetric,
      setNodeSizeMetric: s.setBipartiteNodeSizeMetric,
      nodeGlowMetric: s.bipartiteNodeGlowMetric,
      setNodeGlowMetric: s.setBipartiteNodeGlowMetric,
      nodePulseMetric: s.bipartiteNodePulseMetric,
      setNodePulseMetric: s.setBipartiteNodePulseMetric,
      nodeBorderMetric: s.bipartiteNodeBorderMetric,
      setNodeBorderMetric: s.setBipartiteNodeBorderMetric,
      edgeOpacityMetric: s.bipartiteEdgeOpacityMetric,
      setEdgeOpacityMetric: s.setBipartiteEdgeOpacityMetric,
      showBadges: s.bipartiteShowSpecificityBadges,
      setShowBadges: s.setBipartiteShowSpecificityBadges,
      showGapScore: s.bipartiteShowGapScoreInLabel,
      setShowGapScore: s.setBipartiteShowGapScoreInLabel,
      showClusterGap: s.bipartiteShowClusterGapRatio,
      setShowClusterGap: s.setBipartiteShowClusterGapRatio,
    })),
  )

  return (
    <CollapsibleSection title="Bipartite" defaultCollapsed={false} stickyHeader={false} headerClassName={`px-2 ${uiPanelTextFontClass}`}>
      <div className="px-3 py-2 space-y-2">
        <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
          Maps `/api/graph` (or dev fixture) metrics to the existing 2D D3 scene.
        </div>
        <SelectRow
          label="Data source"
          value={dataSource}
          options={['api', 'fixture', 'workspace']}
          onChange={v => setDataSource(v === 'fixture' ? 'fixture' : v === 'workspace' ? 'workspace' : 'api')}
        />
        <NumberRow label="Poll interval (s)" value={pollIntervalSec} min={3} max={3600} step={1} onChange={setPollIntervalSec} />
        <div className={`pt-1 text-[10px] ${UI_THEME_TOKENS.text.secondary}`}>Metric mapping</div>
        <SelectRow
          label="Node size"
          value={nodeSizeMetric}
          options={['gap_score', 'pmf_score', 'gap_velocity', 'source_count', 'none']}
          onChange={v => {
            const next =
              v === 'pmf_score' || v === 'gap_velocity' || v === 'source_count' || v === 'none' ? v : 'gap_score'
            setNodeSizeMetric(next)
          }}
        />
        <SelectRow
          label="Node glow"
          value={nodeGlowMetric}
          options={['pmf_score', 'gap_score', 'none']}
          onChange={v => {
            const next = v === 'gap_score' || v === 'none' ? v : 'pmf_score'
            setNodeGlowMetric(next)
          }}
        />
        <SelectRow
          label="Pulse speed"
          value={nodePulseMetric}
          options={['gap_velocity', 'pmf_score', 'none']}
          onChange={v => {
            const next = v === 'pmf_score' || v === 'none' ? v : 'gap_velocity'
            setNodePulseMetric(next)
          }}
        />
        <SelectRow
          label="Border thickness"
          value={nodeBorderMetric}
          options={['source_count', 'gap_score', 'none']}
          onChange={v => {
            const next = v === 'gap_score' || v === 'none' ? v : 'source_count'
            setNodeBorderMetric(next)
          }}
        />
        <SelectRow
          label="Edge opacity"
          value={edgeOpacityMetric}
          options={['strength', 'none']}
          onChange={v => setEdgeOpacityMetric(v === 'none' ? 'none' : 'strength')}
        />
        <div className={`pt-1 text-[10px] ${UI_THEME_TOKENS.text.secondary}`}>Labels</div>
        <ToggleRow label="Specificity badges" value={showBadges} onChange={setShowBadges} />
        <ToggleRow label="Gap score in label" value={showGapScore} onChange={setShowGapScore} />
        <ToggleRow label="Cluster gap ratio" value={showClusterGap} onChange={setShowClusterGap} />
      </div>
    </CollapsibleSection>
  )
}
