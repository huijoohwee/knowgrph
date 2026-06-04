import * as d3 from 'd3'
import type { MutableRefObject } from 'react'

import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveContextualZoomDetail } from '@/lib/zoom/viewport'

export function createGraphZoomPresentationApplier(args: {
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  schema: GraphSchema
  onLabelLodVisibilityChange?: (hidden: boolean) => void
}) {
  let lastOpacityTs = 0
  let lastHidden: boolean | null = null
  let lastResponsiveTs = 0
  let lastKEffective: number | null = null
  let lastStrokeKey: string | null = null
  const baseFontSizeRaw = args.schema.labelStyles?.fontSize
  const baseFontSize = typeof baseFontSizeRaw === 'number' && Number.isFinite(baseFontSizeRaw) && baseFontSizeRaw > 0 ? baseFontSizeRaw : 12
  const haloWidthRaw = args.schema.labelStyles?.halo?.width
  const baseHaloWidth = typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3

  return (transform: d3.ZoomTransform) => {
    const now = Date.now()
    const k = transform.k || 1
    const st = useGraphStore.getState()
    const mode = st.zoomLabelScaleMode2d === 'smooth' || st.zoomLabelScaleMode2d === 'power' ? st.zoomLabelScaleMode2d : 'clampAt1'
    const exponentRaw = st.zoomLabelScaleExponent2d
    const exponent = typeof exponentRaw === 'number' && Number.isFinite(exponentRaw) && exponentRaw > 0 ? exponentRaw : 1
    const clampMinRaw = st.zoomLabelScaleClampMin2d
    const clampMaxRaw = st.zoomLabelScaleClampMax2d
    const clampMin = typeof clampMinRaw === 'number' && Number.isFinite(clampMinRaw) && clampMinRaw > 0 ? clampMinRaw : 0.000001
    const clampMax = typeof clampMaxRaw === 'number' && Number.isFinite(clampMaxRaw) && clampMaxRaw > 0 ? clampMaxRaw : 1000000
    const clampScale = (v: number): number => Math.max(clampMin, Math.min(clampMax, v))
    const kEffective =
      mode === 'clampAt1'
        ? clampScale(Math.max(1, k))
        : mode === 'power'
          ? clampScale(Math.pow(Math.max(0.000001, k), exponent))
          : clampScale(Math.max(0.000001, k))
    if (!lastResponsiveTs || now - lastResponsiveTs > 16) {
      lastResponsiveTs = now
      const rounded = Math.round(kEffective * 1000) / 1000
      if (lastKEffective == null || Math.abs(rounded - lastKEffective) > 1e-9) {
        lastKEffective = rounded
        const scaledFontSize = baseFontSize / kEffective
        const scaledHaloWidth = baseHaloWidth / kEffective

        args.g
          .selectAll<SVGTextElement, unknown>('[data-kg-layer="labels"] text.node-label')
          .attr('font-size', scaledFontSize)
          .attr('stroke-width', scaledHaloWidth)
          .attr('dx', function () {
            const raw = (this as SVGTextElement).getAttribute('data-base-dx')
            const base = raw == null ? 0 : Number(raw)
            return Number.isFinite(base) ? base / kEffective : 0
          })
          .attr('dy', function () {
            const raw = (this as SVGTextElement).getAttribute('data-base-dy')
            const base = raw == null ? 0 : Number(raw)
            return Number.isFinite(base) ? base / kEffective : 0
          })

        args.g
          .selectAll<SVGTextElement, unknown>('[data-kg-layer="group-labels"] text')
          .attr('font-size', scaledFontSize)
          .attr('stroke-width', Math.max(2 / kEffective, scaledHaloWidth * 0.85))

        args.g
          .selectAll<SVGTextElement, unknown>('[data-kg-layer="edge-labels"] text')
          .attr('font-size', Math.max(9 / kEffective, (baseFontSize * 0.9) / kEffective))
          .attr('stroke-width', Math.max(2 / kEffective, scaledHaloWidth * 0.85))

        const strokeModeRaw = st.zoomStrokeScaleMode2d
        const strokeMode = strokeModeRaw === 'screenConstant' || strokeModeRaw === 'power' ? strokeModeRaw : 'zoomScaled'
        const strokeExponentRaw = st.zoomStrokeScaleExponent2d
        const strokeExponent =
          typeof strokeExponentRaw === 'number' && Number.isFinite(strokeExponentRaw) && strokeExponentRaw > 0 ? strokeExponentRaw : 1
        const strokeClampMinRaw = st.zoomStrokeScaleClampMin2d
        const strokeClampMaxRaw = st.zoomStrokeScaleClampMax2d
        const strokeClampMin =
          typeof strokeClampMinRaw === 'number' && Number.isFinite(strokeClampMinRaw) && strokeClampMinRaw > 0 ? strokeClampMinRaw : 0.000001
        const strokeClampMax = typeof strokeClampMaxRaw === 'number' && Number.isFinite(strokeClampMaxRaw) && strokeClampMaxRaw > 0 ? strokeClampMaxRaw : 1000
        const clampStrokeScale = (v: number): number => Math.max(strokeClampMin, Math.min(strokeClampMax, v))
        const strokeScale =
          strokeMode === 'power'
            ? clampStrokeScale(Math.pow(Math.max(0.000001, k), strokeExponent))
            : strokeMode === 'screenConstant'
              ? 1
              : 1
        const strokeKey = strokeMode === 'power' ? `${strokeMode}:${Math.round(strokeScale * 1000) / 1000}` : strokeMode
        if (lastStrokeKey !== strokeKey) {
          lastStrokeKey = strokeKey
          const strokeSel = args.g.selectAll<SVGElement, unknown>(
            [
              '[data-kg-layer="links"] line',
              '[data-kg-layer="links"] path',
              '[data-kg-layer="groups"] rect',
              '[data-kg-layer="groups"] path',
              '[data-kg-layer="nodes"] circle',
              '[data-kg-layer="nodes"] rect',
              '[data-kg-layer="nodes"] path[data-kg-node-shape]',
              '[data-kg-layer="node-chevrons"] path[data-kg-node-chevron]',
              '[data-kg-layer="group-labels"] path[data-kg-group-chevron]',
              '[data-kg-layer="port-handles"] circle',
              '[data-kg-layer="temp-link"]',
            ].join(','),
          )
          const baseAttr = 'data-kg-base-stroke-w'
          if (strokeMode === 'zoomScaled') {
            strokeSel.each(function () {
              const el = this as unknown as SVGElement
              const base = el.getAttribute(baseAttr)
              if (base != null && base !== '') {
                const b = Number(base)
                if (Number.isFinite(b)) el.setAttribute('stroke-width', String(b))
              } else {
                const sw = el.getAttribute('stroke-width')
                if (sw != null && sw !== '') el.setAttribute(baseAttr, sw)
              }
              el.removeAttribute('vector-effect')
            })
          } else {
            strokeSel.each(function () {
              const el = this as unknown as SVGElement
              let base = el.getAttribute(baseAttr)
              if (base == null || base === '') {
                base = el.getAttribute('stroke-width') || ''
                if (base) el.setAttribute(baseAttr, base)
              }
              const b = Number(base)
              if (Number.isFinite(b)) {
                const next = strokeMode === 'power' ? Math.max(0, b * strokeScale) : b
                el.setAttribute('stroke-width', String(next))
              }
              el.setAttribute('vector-effect', 'non-scaling-stroke')
            })
          }
        }
      }
    }

    const hidden = resolveContextualZoomDetail({
      k,
      contentThreshold: args.schema.performance?.lod?.hideLabelsBelowScale ?? 0,
    }).hidden
    if (!lastOpacityTs || now - lastOpacityTs > 16) {
      lastOpacityTs = now
      if (hidden !== lastHidden) {
        lastHidden = hidden
        if (args.labelsSelRef.current) {
          args.labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0')
        }
        args.g.selectAll('[data-kg-layer="group-labels"]').style('display', hidden ? 'none' : '')
        args.g.selectAll('[data-kg-layer="edge-labels"]').style('display', hidden ? 'none' : '')
        args.onLabelLodVisibilityChange?.(hidden)
      }
    }
  }
}
