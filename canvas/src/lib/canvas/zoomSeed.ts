import { stripZoomViewKeyVariant } from '@/lib/canvas/zoomViewKeyBase'
import { canSeedCanvasStateAcross2dRenderers } from '@/lib/canvas/rendererStateSeed'

export type ZoomStateLike = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

const RENDERER_PRIORITY = ['storyboard', 'flow', 'd3', 'design']

export function canSeedZoomStateAcross2dRenderers(args: {
  targetRenderer: string | null | undefined
  sourceRenderer: string | null | undefined
}): boolean {
  return canSeedCanvasStateAcross2dRenderers(args)
}

function readRendererFromZoomViewKey(key: string): string {
  const clean = stripZoomViewKeyVariant(key).exact || ''
  const parts = clean.split('|')
  if (parts[0] !== '2d') return ''
  return String(parts[1] || '').trim()
}

export function pickZoomStateWithCrossRendererFallback(args: {
  zoomViewKey: string | null | undefined
  zoomStateByKey: Record<string, ZoomStateLike | null | undefined> | null | undefined
}): ZoomStateLike | null {
  const map = args.zoomStateByKey
  if (!map) return null
  const { exact, base } = stripZoomViewKeyVariant(args.zoomViewKey)
  if (!exact) return null
  const direct = map[exact] ?? null
  if (direct) return direct
  if (base) {
    const baseDirect = map[base] ?? null
    if (baseDirect) return baseDirect
  }

  const key = base || exact
  const targetRenderer = readRendererFromZoomViewKey(exact)
  const parts = key.split('|')
  if (parts.length < 3) return null
  const suffix = parts.slice(2).join('|')
  if (!suffix) return null

  const candidates: Array<{ key: string; state: ZoomStateLike }> = []
  for (const [k, v] of Object.entries(map)) {
    if (!v) continue
    const stripped = stripZoomViewKeyVariant(k)
    const clean = stripped.base || stripped.exact
    if (!clean) continue
    const p = clean.split('|')
    if (p.length < 3) continue
    if (p[0] !== '2d') continue
    if (p.slice(2).join('|') !== suffix) continue
    const sourceRenderer = readRendererFromZoomViewKey(stripped.exact || k)
    if (!canSeedZoomStateAcross2dRenderers({ targetRenderer, sourceRenderer })) continue
    candidates.push({ key: k, state: v })
  }
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const ra = String(a.key).split('|')[1] || ''
    const rb = String(b.key).split('|')[1] || ''
    const ia = RENDERER_PRIORITY.indexOf(ra)
    const ib = RENDERER_PRIORITY.indexOf(rb)
    const pa = ia < 0 ? 999 : ia
    const pb = ib < 0 ? 999 : ib
    if (pa !== pb) return pa - pb
    return String(a.key).localeCompare(String(b.key))
  })
  return candidates[0].state
}
