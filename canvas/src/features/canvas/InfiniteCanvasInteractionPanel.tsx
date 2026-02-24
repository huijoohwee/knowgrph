import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { setPipelinePerfEnabled } from '@/lib/pipelinePerf'
import type { PipelinePerfDetail } from '@/lib/pipelinePerf'

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={props.title}>
      <h3 className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{props.title}</h3>
      <div className="mt-2 space-y-2">{props.children}</div>
    </section>
  )
}

export function InfiniteCanvasInteractionPanel() {
  const {
    schema,
    setSchema,
    canvasPointerMode2d,
    setCanvasPointerMode2d,
    zoomState,
    selectedNodeId,
    selectedNodeIds,
    requestGraphCanvasArrange,
  } = useGraphStore(
    useShallow(s => ({
      schema: s.schema,
      setSchema: s.setSchema,
      canvasPointerMode2d: s.canvasPointerMode2d,
      setCanvasPointerMode2d: s.setCanvasPointerMode2d,
      zoomState: s.zoomState,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      requestGraphCanvasArrange: s.requestGraphCanvasArrange,
    })),
  )

  const layoutMode = schema?.layout?.mode === 'radial' ? 'radial' : 'force'
  const zoomPct = Math.round(((zoomState?.k ?? 1) * 100) / 1) || 100

  const selectedCount = (Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0)
    ? selectedNodeIds.length
    : selectedNodeId
      ? 1
      : 0

  const [perfOpen, setPerfOpen] = React.useState(false)
  const [rafFps, setRafFps] = React.useState(0)
  const [stateUps, setStateUps] = React.useState(0)
  const [lastLayoutInitMs, setLastLayoutInitMs] = React.useState<number | null>(null)

  React.useEffect(() => {
    setPipelinePerfEnabled(perfOpen)
  }, [perfOpen])

  React.useEffect(() => {
    if (!perfOpen) return
    let raf = 0
    let frameCount = 0
    let lastTs = performance.now()
    const loop = (ts: number) => {
      frameCount += 1
      if (ts - lastTs >= 1000) {
        setRafFps(frameCount)
        frameCount = 0
        lastTs = ts
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [perfOpen])

  React.useEffect(() => {
    if (!perfOpen) return
    let zoomUpdates = 0
    let layoutUpdates = 0
    const unsubZoom = useGraphStore.subscribe(s => s.zoomState, () => {
      zoomUpdates += 1
    })
    const unsubLayout = useGraphStore.subscribe(s => s.layoutPositionCacheByMode, () => {
      layoutUpdates += 1
    })
    const timer = window.setInterval(() => {
      setStateUps(zoomUpdates + layoutUpdates)
      zoomUpdates = 0
      layoutUpdates = 0
    }, 1000)
    return () => {
      unsubZoom()
      unsubLayout()
      window.clearInterval(timer)
    }
  }, [perfOpen])

  React.useEffect(() => {
    if (!perfOpen) return
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<PipelinePerfDetail>
      const d = e.detail
      if (!d) return
      if (d.name === 'render' && d.stage === 'layout:init') {
        setLastLayoutInitMs(Math.round(d.durationMs * 10) / 10)
      }
    }
    window.addEventListener('kg-pipeline-perf', handler as EventListener)
    return () => {
      window.removeEventListener('kg-pipeline-perf', handler as EventListener)
    }
  }, [perfOpen])

  return (
    <div className="space-y-4">
      <Section title="Interaction">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-md border px-2 py-1.5 text-xs transition ${UI_THEME_TOKENS.input.border} ${canvasPointerMode2d !== 'pan' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => setCanvasPointerMode2d('select')}
            aria-label="Select/Drag mode"
          >
            Select/Drag
          </button>
          <button
            type="button"
            className={`rounded-md border px-2 py-1.5 text-xs transition ${UI_THEME_TOKENS.input.border} ${canvasPointerMode2d === 'pan' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => setCanvasPointerMode2d('pan')}
            aria-label="Pan mode"
          >
            Pan
          </button>
        </div>

        <label className={`block text-xs ${UI_THEME_TOKENS.text.secondary}`}>
          Layout
          <select
            className={`mt-1 w-full rounded-md border px-2 py-1.5 text-xs ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`}
            value={layoutMode}
            onChange={e => {
              const next = e.target.value === 'radial' ? 'radial' : 'force'
              setSchema({ ...schema, layout: { ...(schema.layout || {}), mode: next } })
            }}
          >
            <option value="force">Force</option>
            <option value="radial">Radial</option>
          </select>
        </label>

        <div className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>Zoom: {zoomPct}%</div>
      </Section>

      <Section title="Centering / Centroid">
        <button
          type="button"
          className={`w-full rounded-md border px-2 py-1.5 text-xs transition ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          disabled={selectedCount === 0}
          onClick={() => requestGraphCanvasArrange({ type: 'center', scope: 'selection' })}
        >
          Center on Selection
        </button>
        <button
          type="button"
          className={`w-full rounded-md border px-2 py-1.5 text-xs transition ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          onClick={() => requestGraphCanvasArrange({ type: 'center', scope: 'all' })}
        >
          Center on All Items
        </button>
      </Section>

      <Section title="Even Spread">
        <button
          type="button"
          className={`w-full rounded-md border px-2 py-1.5 text-xs transition ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          disabled={selectedCount < 3}
          onClick={() => requestGraphCanvasArrange({ type: 'distribute', axis: 'x' })}
        >
          Distribute Horizontally
        </button>
        <button
          type="button"
          className={`w-full rounded-md border px-2 py-1.5 text-xs transition ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          disabled={selectedCount < 3}
          onClick={() => requestGraphCanvasArrange({ type: 'distribute', axis: 'y' })}
        >
          Distribute Vertically
        </button>
        <div className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>
          {selectedCount < 3 ? 'Select at least 3 nodes.' : `Selected: ${selectedCount}`}
        </div>
      </Section>

      <Section title="Performance">
        <button
          type="button"
          className={`w-full rounded-md border px-2 py-1.5 text-xs transition ${UI_THEME_TOKENS.input.border} ${perfOpen ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
          onClick={() => setPerfOpen(v => !v)}
        >
          {perfOpen ? 'Hide Perf Overlay' : 'Show Perf Overlay'}
        </button>
        {perfOpen ? (
          <div className={`rounded-md border p-2 text-xs ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <div className={`flex items-center justify-between ${UI_THEME_TOKENS.text.secondary}`}>
              <span>Render updates/sec</span>
              <span className="font-mono">{rafFps}</span>
            </div>
            <div className={`mt-1 flex items-center justify-between ${UI_THEME_TOKENS.text.secondary}`}>
              <span>State updates/sec</span>
              <span className="font-mono">{stateUps}</span>
            </div>
            <div className={`mt-1 flex items-center justify-between ${UI_THEME_TOKENS.text.secondary}`}>
              <span>Last layout init (ms)</span>
              <span className="font-mono">{lastLayoutInitMs == null ? '-' : lastLayoutInitMs}</span>
            </div>
          </div>
        ) : null}
      </Section>
    </div>
  )
}
