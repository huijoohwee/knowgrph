import { useEffect } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

export function useGroupSelectionHighlight(args: {
  paused?: boolean
  gRef: React.MutableRefObject<GSelection | null>
}) {
  const { paused, gRef } = args
  useEffect(() => {
    if (paused) return

    const arrayEq = (a: unknown, b: unknown): boolean => {
      const aa = Array.isArray(a) ? a : []
      const bb = Array.isArray(b) ? b : []
      if (aa.length !== bb.length) return false
      for (let i = 0; i < aa.length; i += 1) {
        if (String(aa[i] || '') !== String(bb[i] || '')) return false
      }
      return true
    }

    let rafId: number | null = null
    const apply = () => {
      const g = gRef.current
      if (!g) return
      const state = useGraphStore.getState()
      const schema = state.schema as GraphSchema | null
      if (!schema) return
      const selected = new Set<string>()
      const primary = typeof state.selectedGroupId === 'string' ? state.selectedGroupId : null
      if (primary) selected.add(primary)
      const many = Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds : []
      for (let i = 0; i < many.length; i += 1) {
        const id = String(many[i] || '')
        if (id) selected.add(id)
      }

      const groupsCfg = schema.layout?.groups || {}
      const baseStrokeWidth =
        typeof groupsCfg.strokeWidth === 'number' && Number.isFinite(groupsCfg.strokeWidth) ? Math.max(0, groupsCfg.strokeWidth) : 1.5
      const baseFillOpacity =
        typeof groupsCfg.fillOpacity === 'number' && Number.isFinite(groupsCfg.fillOpacity)
          ? Math.max(0, Math.min(1, groupsCfg.fillOpacity))
          : 0.08
      const selectedStrokeWidth = baseStrokeWidth * 2.2
      const selectedFillOpacity = Math.min(0.28, baseFillOpacity * 2.5)

      g.selectAll<SVGGElement, { id?: string }>('[data-kg-layer="groups"] [data-kg-group-id]').each(function () {
        const el = d3.select(this)
        const id = String(el.attr('data-kg-group-id') || '')
        const isSelected = !!id && selected.has(id)
        el.attr('data-kg-selected', isSelected ? '1' : '0')
        el.selectAll<SVGRectElement | SVGPathElement, unknown>('rect[data-kg-shape], path[data-kg-shape]')
          .attr('stroke-width', isSelected ? selectedStrokeWidth : baseStrokeWidth)
          .attr('fill-opacity', isSelected ? selectedFillOpacity : baseFillOpacity)
          .attr('stroke', isSelected ? MVP_COLOR_PALETTE.nodes.idea : null)
      })

      g.selectAll<SVGTextElement, unknown>('[data-kg-layer="group-labels"] text[data-kg-group-id]')
        .attr('font-weight', function () {
          const id = String(d3.select(this).attr('data-kg-group-id') || '')
          return id && selected.has(id) ? '700' : '500'
        })
        .attr('opacity', function () {
          const id = String(d3.select(this).attr('data-kg-group-id') || '')
          if (!selected.size) return 0.95
          return id && selected.has(id) ? 1 : 0.35
        })
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
        selectedGroupId: (s as unknown as { selectedGroupId?: string | null }).selectedGroupId ?? null,
        selectedGroupIds: (s as unknown as { selectedGroupIds?: string[] }).selectedGroupIds ?? [],
        graphDataRevision: s.graphDataRevision,
        schema: s.schema,
      }),
      () => schedule(),
      {
        equalityFn: (a, b) => {
          if (a.selectedGroupId !== b.selectedGroupId) return false
          if (!arrayEq(a.selectedGroupIds, b.selectedGroupIds)) return false
          if (a.graphDataRevision !== b.graphDataRevision) return false
          if (a.schema !== b.schema) return false
          return true
        },
      },
    )
    schedule()
    return () => {
      unsub()
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [paused, gRef])
}
