import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'
import { relaxAabbLabels, type AabbLabelParticle } from '@/lib/ui/labels/relaxAabbLabels'
import { estimateLabelCharWidthPx, estimateMaxCharsForWidthPx, truncateTextWithEllipsis } from '@/lib/ui/text/labelText'
import type {
  DesignCanvasFrameNodeRef,
  DesignCanvasFrameRect,
  DesignCanvasLabelChip,
  DesignCanvasLabelLayout,
  DesignCanvasNodeStyle,
} from '@/components/DesignCanvas/types'

type WireframeSettingsLike = {
  showLabelChips: boolean
  showMetaChips: boolean
  avoidLabelCollisions: boolean
  maxLabelChars: number
}

type UseDesignCanvasLabelLayoutArgs = {
  styleById: Map<string, DesignCanvasNodeStyle> | null
  wireframeSettings: WireframeSettingsLike
  schema: GraphSchema | null
  documentSemanticMode: 'document' | 'keyword' | undefined
  renderNodes: DesignCanvasFrameNodeRef[]
  positions: Record<string, DesignCanvasFrameRect>
  selectedNodeIds: readonly unknown[]
  denseRender: boolean
}

type Rect = {
  x: number
  y: number
  w: number
  h: number
}

type AreaRect = Rect & {
  area: number
}

type Candidate = {
  boxX: number
  boxY: number
  textX: number
  textY: number
  textAnchor: 'start' | 'end'
}

function rectIntersects(a: Rect, b: Rect) {
  const ax1 = a.x + a.w
  const ay1 = a.y + a.h
  const bx1 = b.x + b.w
  const by1 = b.y + b.h
  return a.x < bx1 && ax1 > b.x && a.y < by1 && ay1 > b.y
}

function rectIntersectionArea(a: Rect, b: Rect) {
  const ix0 = Math.max(a.x, b.x)
  const iy0 = Math.max(a.y, b.y)
  const ix1 = Math.min(a.x + a.w, b.x + b.w)
  const iy1 = Math.min(a.y + a.h, b.y + b.h)
  const iw = Math.max(0, ix1 - ix0)
  const ih = Math.max(0, iy1 - iy0)
  return iw > 0 && ih > 0 ? iw * ih : 0
}

function buildLabelChip(args: {
  candidate: Candidate
  boxW: number
  boxH: number
  text: string
  fontSize: number
  fontWeight?: number
  fill: string
  bgFill: string
  bgOpacity: number
  stroke: string
  strokeOpacity: number
}): DesignCanvasLabelChip {
  const { candidate, boxW, boxH, text, fontSize, fontWeight, fill, bgFill, bgOpacity, stroke, strokeOpacity } = args
  return {
    boxX: candidate.boxX,
    boxY: candidate.boxY,
    boxW,
    boxH,
    textX: candidate.textX,
    textY: candidate.textY,
    textAnchor: candidate.textAnchor,
    text,
    fontSize,
    ...(typeof fontWeight === 'number' ? { fontWeight } : {}),
    fill,
    bgFill,
    bgOpacity,
    stroke,
    strokeOpacity,
  }
}

export function useDesignCanvasLabelLayout(args: UseDesignCanvasLabelLayoutArgs) {
  const { styleById, wireframeSettings, schema, documentSemanticMode, renderNodes, positions, selectedNodeIds, denseRender } = args

  return React.useMemo(() => {
    const map = new Map<string, DesignCanvasLabelLayout>()
    if (!styleById) return map
    if (!wireframeSettings.showLabelChips && !wireframeSettings.showMetaChips) return map

    const labelPresentation = readLabelPresentation2d({ schema, documentSemanticMode })
    const labelFontSize = labelPresentation.nodeFontSizePx
    const metaFontSize = Math.max(9, Math.min(16, Math.round(labelFontSize * 0.85)))
    const cell = 180
    const cellKey = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`
    const neighbors = (x: number, y: number) => {
      const gx = Math.floor(x / cell)
      const gy = Math.floor(y / cell)
      const out: string[] = []
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) out.push(`${gx + dx}:${gy + dy}`)
      }
      return out
    }
    const labelRectsByCell = new Map<string, Rect[]>()
    const frameRectsByCell = new Map<string, AreaRect[]>()
    const canPlaceLabel = (rect: Rect) => {
      const keys = neighbors(rect.x, rect.y)
      for (let i = 0; i < keys.length; i += 1) {
        const list = labelRectsByCell.get(keys[i]!)
        if (!list) continue
        for (let j = 0; j < list.length; j += 1) {
          if (rectIntersects(rect, list[j]!)) return false
        }
      }
      return true
    }
    const addLabelRect = (rect: Rect) => {
      const key = cellKey(rect.x, rect.y)
      const list = labelRectsByCell.get(key)
      if (list) list.push(rect)
      else labelRectsByCell.set(key, [rect])
    }
    const addFrameRect = (rect: AreaRect) => {
      const key = cellKey(rect.x, rect.y)
      const list = frameRectsByCell.get(key)
      if (list) list.push(rect)
      else frameRectsByCell.set(key, [rect])
    }
    const isMostlyOccluded = (rect: AreaRect) => {
      if (!(rect.area > 0)) return false
      const keys = neighbors(rect.x, rect.y)
      for (let i = 0; i < keys.length; i += 1) {
        const list = frameRectsByCell.get(keys[i]!)
        if (!list) continue
        for (let j = 0; j < list.length; j += 1) {
          const other = list[j]!
          const ratio = rectIntersectionArea(rect, other) / rect.area
          if (ratio >= 0.72) return true
        }
      }
      return false
    }
    const zKey = (style: DesignCanvasNodeStyle | null | undefined) => {
      const z = style?.zIndex ?? 0
      const position = String(style?.position || '').toLowerCase()
      const tag = String(style?.tag || '').toUpperCase()
      const kind = String(style?.kind || '')
      let boost = 0
      if (position === 'fixed' || position === 'sticky') boost += 1000
      if (tag === 'HEADER' || tag === 'NAV') boost += 220
      if (tag === 'FOOTER') boost += 80
      if (kind === 'interactive') boost += 120
      if (kind === 'media') boost += 60
      return z + boost
    }
    const importantTag = (tag: string) => {
      const value = String(tag || '').toUpperCase()
      return value === 'HEADER' || value === 'NAV' || value === 'MAIN' || value === 'FOOTER' || value === 'SECTION'
    }
    const selectedSet = new Set<string>()
    for (let i = 0; i < selectedNodeIds.length; i += 1) {
      const id = String(selectedNodeIds[i] || '').trim()
      if (id && positions[id]) selectedSet.add(id)
    }

    const ordered = renderNodes
      .slice()
      .map(node => {
        const position = positions[node.id]
        const style = styleById.get(node.id) || null
        const area = position ? position.w * position.h : 0
        return { id: node.id, label: node.label, meta: node.type || node.id, position, style, area, z: zKey(style) }
      })
      .filter(entry => !!entry.position && entry.area > 0)
    ordered.sort((a, b) => b.z - a.z || b.area - a.area || a.id.localeCompare(b.id))

    const placed: Array<{
      particleId: string
      nodeId: string
      kind: 'label' | 'meta'
      z: number
      important: boolean
      position: DesignCanvasFrameRect
    }> = []

    for (let i = 0; i < ordered.length; i += 1) {
      const entry = ordered[i]!
      const position = entry.position!
      const style = entry.style
      const kind = String(style?.kind || '')
      const tag = String(style?.tag || '')
      const selected = selectedSet.has(entry.id)
      const important = selected || kind === 'interactive' || kind === 'media' || importantTag(tag)
      const frameRect: AreaRect = { x: position.x, y: position.y, w: position.w, h: position.h, area: entry.area }

      if (!important && isMostlyOccluded(frameRect)) {
        addFrameRect(frameRect)
        continue
      }

      const maxLabelW = Math.max(0, Math.min(420, position.w - 24))
      const maxMetaW = Math.max(0, Math.min(320, position.w - 24))
      const showLabel =
        wireframeSettings.showLabelChips &&
        (important ||
          (!denseRender && position.w >= 84 && position.h >= 26 && entry.area >= 1200) ||
          (denseRender && position.w >= 140 && position.h >= 34 && entry.area >= 24_000 && kind !== 'element'))
      const showMeta = wireframeSettings.showMetaChips && important && !denseRender && position.w >= 140 && position.h >= 26

      const layout: DesignCanvasLabelLayout = {}
      if (showLabel && maxLabelW >= 48) {
        const fontSize = labelFontSize
        const boxH = 18
        const padX = 8
        const maxChars = Math.min(wireframeSettings.maxLabelChars, estimateMaxCharsForWidthPx(Math.max(0, maxLabelW - 18), fontSize))
        const text = truncateTextWithEllipsis(entry.label, maxChars)
        const boxW = Math.max(48, Math.min(maxLabelW, text.length * estimateLabelCharWidthPx(fontSize) + 18))
        const candidates: Candidate[] = [
          { boxX: 10, boxY: 8, textX: 10 + padX, textY: 21, textAnchor: 'start' },
          { boxX: Math.max(10, position.w - 10 - boxW), boxY: 8, textX: position.w - 10 - padX, textY: 21, textAnchor: 'end' },
          {
            boxX: 10,
            boxY: Math.max(6, position.h - 8 - boxH),
            textX: 10 + padX,
            textY: Math.max(6, position.h - 8 - boxH) + 13,
            textAnchor: 'start',
          },
          {
            boxX: Math.max(10, position.w - 10 - boxW),
            boxY: Math.max(6, position.h - 8 - boxH),
            textX: position.w - 10 - padX,
            textY: Math.max(6, position.h - 8 - boxH) + 13,
            textAnchor: 'end',
          },
        ]
        if (!wireframeSettings.avoidLabelCollisions) {
          layout.label = buildLabelChip({
            candidate: candidates[0]!,
            boxW,
            boxH,
            text,
            fontSize,
            fontWeight: 600,
            fill: 'var(--kg-text-primary)',
            bgFill: 'var(--kg-panel-bg)',
            bgOpacity: 0.92,
            stroke: 'var(--kg-border)',
            strokeOpacity: 0.7,
          })
        } else {
          for (let c = 0; c < candidates.length; c += 1) {
            const candidate = candidates[c]!
            const worldRect = { x: position.x + candidate.boxX, y: position.y + candidate.boxY, w: boxW, h: boxH }
            if (!canPlaceLabel(worldRect)) continue
            addLabelRect(worldRect)
            layout.label = buildLabelChip({
              candidate,
              boxW,
              boxH,
              text,
              fontSize,
              fontWeight: 600,
              fill: 'var(--kg-text-primary)',
              bgFill: 'var(--kg-panel-bg)',
              bgOpacity: 0.92,
              stroke: 'var(--kg-border)',
              strokeOpacity: 0.7,
            })
            break
          }
        }
      }

      if (showMeta && maxMetaW >= 48) {
        const fontSize = metaFontSize
        const boxH = 16
        const padX = 7
        const maxChars = Math.min(wireframeSettings.maxLabelChars, estimateMaxCharsForWidthPx(Math.max(0, maxMetaW - 18), fontSize))
        const text = truncateTextWithEllipsis(entry.meta, maxChars)
        const boxW = Math.max(44, Math.min(maxMetaW, text.length * estimateLabelCharWidthPx(fontSize) + 18))
        const candidates: Candidate[] = [
          { boxX: Math.max(10, position.w - 10 - boxW), boxY: 8, textX: position.w - 10 - padX, textY: 20, textAnchor: 'end' },
          { boxX: 10, boxY: 8, textX: 10 + padX, textY: 20, textAnchor: 'start' },
          {
            boxX: Math.max(10, position.w - 10 - boxW),
            boxY: Math.max(6, position.h - 8 - boxH),
            textX: position.w - 10 - padX,
            textY: Math.max(6, position.h - 8 - boxH) + 12,
            textAnchor: 'end',
          },
        ]
        if (!wireframeSettings.avoidLabelCollisions) {
          layout.meta = buildLabelChip({
            candidate: candidates[0]!,
            boxW,
            boxH,
            text,
            fontSize,
            fill: 'var(--kg-text-tertiary)',
            bgFill: 'var(--kg-panel-bg)',
            bgOpacity: 0.9,
            stroke: 'var(--kg-border)',
            strokeOpacity: 0.6,
          })
        } else {
          for (let c = 0; c < candidates.length; c += 1) {
            const candidate = candidates[c]!
            const worldRect = { x: position.x + candidate.boxX, y: position.y + candidate.boxY, w: boxW, h: boxH }
            if (!canPlaceLabel(worldRect)) continue
            addLabelRect(worldRect)
            layout.meta = buildLabelChip({
              candidate,
              boxW,
              boxH,
              text,
              fontSize,
              fill: 'var(--kg-text-tertiary)',
              bgFill: 'var(--kg-panel-bg)',
              bgOpacity: 0.9,
              stroke: 'var(--kg-border)',
              strokeOpacity: 0.6,
            })
            break
          }
        }
      }

      if (layout.label || layout.meta) {
        map.set(entry.id, layout)
        if (layout.label) placed.push({ particleId: `${entry.id}:label`, nodeId: entry.id, kind: 'label', z: entry.z, important, position })
        if (layout.meta) placed.push({ particleId: `${entry.id}:meta`, nodeId: entry.id, kind: 'meta', z: entry.z, important, position })
      }
      addFrameRect(frameRect)
    }

    if (wireframeSettings.avoidLabelCollisions && placed.length >= 2) {
      const particles: AabbLabelParticle[] = []
      const byParticleId = new Map<string, { nodeId: string; kind: 'label' | 'meta'; position: DesignCanvasFrameRect }>()
      for (let i = 0; i < placed.length; i += 1) {
        const placedItem = placed[i]!
        const layout = map.get(placedItem.nodeId)
        if (!layout) continue
        const chip = placedItem.kind === 'label' ? layout.label : layout.meta
        if (!chip) continue
        const centerX = placedItem.position.x + chip.boxX + chip.boxW / 2
        const centerY = placedItem.position.y + chip.boxY + chip.boxH / 2
        particles.push({
          id: placedItem.particleId,
          baseX: centerX,
          baseY: centerY,
          x: centerX,
          y: centerY,
          vx: 0,
          vy: 0,
          halfW: chip.boxW / 2,
          halfH: chip.boxH / 2,
          dxClamp: Math.max(18, Math.min(120, Math.floor(placedItem.position.w * 0.22))),
          dyClamp: Math.max(14, Math.min(90, Math.floor(placedItem.position.h * 0.18))),
          weight: (placedItem.important ? 2.2 : 1) + Math.max(0, Math.min(2, placedItem.z / 1200)),
        })
        byParticleId.set(placedItem.particleId, { nodeId: placedItem.nodeId, kind: placedItem.kind, position: placedItem.position })
      }
      relaxAabbLabels({ particles, steps: 16, maxOps: 32_000 })
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]!
        const ref = byParticleId.get(particle.id)
        if (!ref) continue
        const layout = map.get(ref.nodeId)
        if (!layout) continue
        const chip = ref.kind === 'label' ? layout.label : layout.meta
        if (!chip) continue
        const localX = particle.x - chip.boxW / 2 - ref.position.x
        const localY = particle.y - chip.boxH / 2 - ref.position.y
        const minX = 6
        const minY = 6
        const maxX = Math.max(minX, ref.position.w - 6 - chip.boxW)
        const maxY = Math.max(minY, ref.position.h - 6 - chip.boxH)
        const boxX = Math.max(minX, Math.min(maxX, localX))
        const boxY = Math.max(minY, Math.min(maxY, localY))
        const padX = ref.kind === 'label' ? 8 : 7
        const textX = chip.textAnchor === 'end' ? boxX + chip.boxW - padX : boxX + padX
        const textY = boxY + (ref.kind === 'label' ? 13 : 12)
        if (ref.kind === 'label') layout.label = { ...chip, boxX, boxY, textX, textY }
        else layout.meta = { ...chip, boxX, boxY, textX, textY }
        map.set(ref.nodeId, layout)
      }
    }

    return map
  }, [denseRender, documentSemanticMode, positions, renderNodes, schema, selectedNodeIds, styleById, wireframeSettings])
}
