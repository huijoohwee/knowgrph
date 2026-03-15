import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEFAULT_CANVAS_LAYER_ORDER_2D } from '@/lib/canvas/layerOrder2d'

export function testGraphCanvasLayerOrderSsotIncludesResizeHandlesAndGroupHit() {
  const rankById = new Map(DEFAULT_CANVAS_LAYER_ORDER_2D.map(x => [x.id, x.rank]))
  const mustHave = ['groups-hit', 'group-resize-handles', 'resize-handles']
  for (let i = 0; i < mustHave.length; i += 1) {
    const id = mustHave[i]
    if (!rankById.has(id)) throw new Error(`missing layer id in SSOT: ${id}`)
  }
  const labels = rankById.get('labels')
  const ports = rankById.get('port-handles')
  if (typeof labels !== 'number' || typeof ports !== 'number') throw new Error('missing labels or port-handles rank')
  if (ports <= labels) throw new Error('expected port-handles to be above labels')
  const resize = rankById.get('resize-handles')
  const nodes = rankById.get('nodes')
  if (typeof resize !== 'number' || typeof nodes !== 'number') throw new Error('missing resize-handles or nodes rank')
  if (resize <= nodes) throw new Error('expected resize-handles to be above nodes')
}

export function testGraphCanvasGroupDragWritesVisualZIndexNotOverrideKey() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'groups.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('visual:zIndexOverride')) {
    throw new Error('expected groups drag z-index override to use visual:zIndex (SSOT)')
  }
  if (!text.includes("'visual:zIndex'")) {
    throw new Error('expected groups drag z-index override to write visual:zIndex')
  }
}

