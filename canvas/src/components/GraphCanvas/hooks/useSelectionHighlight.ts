import { useEffect } from 'react'
import * as d3 from 'd3'
import { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { selectionPerfEnd, selectionPerfStart } from '@/lib/selectionPerf'
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight'
import { UI_THEME_COLORS } from '@/lib/ui/theme-tokens'
import type { ThemeMode } from '@/lib/ui/theme'

interface UseSelectionHighlightProps {
  paused?: boolean
  nodesSelRef: React.MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: React.MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  labelsSelRef: React.MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  linksSelRef: React.MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
}

export function useSelectionHighlight({
  paused,
  nodesSelRef,
  mediaSelRef,
  labelsSelRef,
  linksSelRef,
}: UseSelectionHighlightProps) {
  useEffect(() => {
    if (paused) return
    let rafId: number | null = null
    const apply = () => {
      const state = useGraphStore.getState()
      const graphData = state.graphData as GraphData | null
      const schema = state.schema as GraphSchema | null
      if (!graphData || !schema) return
      const themeMode = state.themeMode as ThemeMode
      const isDark =
        themeMode === 'dark' ||
        (themeMode === 'system' &&
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      const themeColors = isDark ? UI_THEME_COLORS.dark : UI_THEME_COLORS.light
      const t0 = selectionPerfStart()
      state.setLifecycleStage('selectionUpdate')
      applySelectionHighlight(
        nodesSelRef.current,
        mediaSelRef.current,
        labelsSelRef.current,
        linksSelRef.current,
        graphData,
        schema,
        state.selectedNodeId,
        state.selectedEdgeId,
        state.selectedNodeIds,
        state.selectedEdgeIds,
        state.renderMediaAsNodes,
        { mediaNodeOpacity: state.mediaNodeOpacity, themeColors },
      )
      selectionPerfEnd('canvas', t0)
    }
    const schedule = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        apply()
      })
    }
    const unsub = useGraphStore.subscribe(
      s => ({
        selectedNodeId: s.selectedNodeId,
        selectedEdgeId: s.selectedEdgeId,
        selectedNodeIds: s.selectedNodeIds,
        selectedEdgeIds: s.selectedEdgeIds,
        mediaNodeOpacity: s.mediaNodeOpacity,
        renderMediaAsNodes: s.renderMediaAsNodes,
        themeMode: s.themeMode,
        graphDataRevision: s.graphDataRevision,
      }),
      () => schedule(),
    )
    schedule()
    return () => {
      unsub()
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [paused, nodesSelRef, mediaSelRef, labelsSelRef, linksSelRef])
}
