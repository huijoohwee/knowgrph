import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { CanvasPerformanceReadoutOverlay } from '@/features/canvas/CanvasPerformanceReadoutOverlay'
import { setPipelinePerfEnabled } from '@/lib/pipelinePerf'
import type { PipelinePerfDetail } from '@/lib/pipelinePerf'

type PerfStageEntry = {
  key: string
  label: string
  durationMs: number
}

export function PerformanceAutomationReadout() {
  const automationPerfEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('kgAutomationPerf') === '1'
  }, [])
  const [rafFps, setRafFps] = useState(0)
  const [lastLayoutInitMs, setLastLayoutInitMs] = useState<number | null>(null)
  const [recentPerfStages, setRecentPerfStages] = useState<PerfStageEntry[]>([])

  useEffect(() => {
    if (!automationPerfEnabled) return
    setPipelinePerfEnabled(true)
    return () => {
      setPipelinePerfEnabled(false)
    }
  }, [automationPerfEnabled])

  useEffect(() => {
    if (!automationPerfEnabled) return
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
  }, [automationPerfEnabled])

  useEffect(() => {
    if (!automationPerfEnabled) return
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<PipelinePerfDetail>
      const d = e.detail
      if (!d) return
      if (d.name === 'render' && d.stage === 'layout:init') {
        setLastLayoutInitMs(Math.round(d.durationMs * 10) / 10)
      }
      if (d.name === 'render' && (d.stage.startsWith('graphRoot:') || d.stage.startsWith('scene:') || d.stage.startsWith('presentation:'))) {
        const label = d.stage.replace(/^graphRoot:/, 'root:').replace(/^presentation:/, 'present:')
        const durationMs = Math.round(d.durationMs * 10) / 10
        setRecentPerfStages(prev => {
          const next = [{ key: d.stage, label, durationMs }, ...prev.filter(entry => entry.key !== d.stage)]
          return next.slice(0, 6)
        })
      }
    }
    window.addEventListener('kg-pipeline-perf', handler as EventListener)
    return () => {
      window.removeEventListener('kg-pipeline-perf', handler as EventListener)
    }
  }, [automationPerfEnabled])

  const automationPerfLines = useMemo(() => {
    if (!automationPerfEnabled) return []
    const lines = [
      `render_updates_per_sec=${rafFps}`,
      `last_layout_init_ms=${lastLayoutInitMs == null ? '-' : lastLayoutInitMs}`,
    ]
    for (let i = 0; i < recentPerfStages.length; i += 1) {
      const entry = recentPerfStages[i]!
      lines.push(`stage.${entry.label.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()}=${entry.durationMs}`)
    }
    return lines
  }, [automationPerfEnabled, lastLayoutInitMs, rafFps, recentPerfStages])

  if (!automationPerfEnabled || typeof document === 'undefined' || !document.body) return null

  return createPortal(
    <CanvasPerformanceReadoutOverlay lines={automationPerfLines} />,
    document.body,
  )
}
