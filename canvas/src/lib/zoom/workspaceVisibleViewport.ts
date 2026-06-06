import { normalizeViewportFrame, type ViewportFrame } from '@/lib/zoom/viewport'

export const WORKSPACE_VISIBLE_VIEWPORT_OCCLUDER_ATTR = 'data-kg-workspace-visible-viewport-occluder'

export type WorkspaceVisibleViewportOccluderRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

const MIN_VISIBLE_VIEWPORT_RATIO = 0.12
const MIN_VISIBLE_VIEWPORT_PX = 96
const EDGE_EPSILON_PX = 4

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isUsableRect = (rect: WorkspaceVisibleViewportOccluderRect | null | undefined): rect is WorkspaceVisibleViewportOccluderRect =>
  !!rect
  && isFiniteNumber(rect.left)
  && isFiniteNumber(rect.top)
  && isFiniteNumber(rect.right)
  && isFiniteNumber(rect.bottom)
  && rect.right > rect.left
  && rect.bottom > rect.top

const rectFromDomRect = (rect: DOMRect | ClientRect): WorkspaceVisibleViewportOccluderRect | null => {
  if (!rect) return null
  const left = Number(rect.left)
  const top = Number(rect.top)
  const right = Number(rect.right)
  const bottom = Number(rect.bottom)
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) return null
  if (!(right > left) || !(bottom > top)) return null
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

const localizeOccluderRect = (args: {
  occluder: WorkspaceVisibleViewportOccluderRect
  surface: WorkspaceVisibleViewportOccluderRect
  viewportW: number
  viewportH: number
}): WorkspaceVisibleViewportOccluderRect | null => {
  const { occluder, surface } = args
  const left = Math.max(0, Math.min(args.viewportW, occluder.left - surface.left))
  const right = Math.max(0, Math.min(args.viewportW, occluder.right - surface.left))
  const top = Math.max(0, Math.min(args.viewportH, occluder.top - surface.top))
  const bottom = Math.max(0, Math.min(args.viewportH, occluder.bottom - surface.top))
  if (!(right > left) || !(bottom > top)) return null
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

export function resolveWorkspaceVisibleViewportFromOccluders(args: {
  viewportW: number
  viewportH: number
  workspaceEditorOverlayOpen?: boolean
  surfaceRect?: WorkspaceVisibleViewportOccluderRect | null
  occluderRects?: WorkspaceVisibleViewportOccluderRect[] | null
}): ViewportFrame {
  const viewportW = Math.max(1, Math.floor(isFiniteNumber(args.viewportW) ? args.viewportW : 1))
  const viewportH = Math.max(1, Math.floor(isFiniteNumber(args.viewportH) ? args.viewportH : 1))
  const fallback = normalizeViewportFrame({ viewportW, viewportH })
  if (args.workspaceEditorOverlayOpen !== true) return fallback

  const surface = isUsableRect(args.surfaceRect)
    ? args.surfaceRect
    : { left: 0, top: 0, right: viewportW, bottom: viewportH, width: viewportW, height: viewportH }
  const occluders = Array.isArray(args.occluderRects) ? args.occluderRects : []
  if (occluders.length === 0) return fallback

  let left = 0
  let top = 0
  let right = viewportW
  let bottom = viewportH
  for (let i = 0; i < occluders.length; i += 1) {
    const raw = occluders[i]
    if (!isUsableRect(raw)) continue
    const rect = localizeOccluderRect({ occluder: raw, surface, viewportW, viewportH })
    if (!rect) continue
    const coversMostHeight = rect.height >= viewportH * 0.5
    const coversMostWidth = rect.width >= viewportW * 0.5
    if (coversMostHeight && rect.left <= EDGE_EPSILON_PX && rect.right < viewportW - EDGE_EPSILON_PX) {
      left = Math.max(left, rect.right)
    } else if (coversMostHeight && rect.right >= viewportW - EDGE_EPSILON_PX && rect.left > EDGE_EPSILON_PX) {
      right = Math.min(right, rect.left)
    }
    if (coversMostWidth && rect.top <= EDGE_EPSILON_PX && rect.bottom < viewportH - EDGE_EPSILON_PX) {
      top = Math.max(top, rect.bottom)
    } else if (coversMostWidth && rect.bottom >= viewportH - EDGE_EPSILON_PX && rect.top > EDGE_EPSILON_PX) {
      bottom = Math.min(bottom, rect.top)
    }
  }

  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  const minWidth = Math.max(MIN_VISIBLE_VIEWPORT_PX, viewportW * MIN_VISIBLE_VIEWPORT_RATIO)
  const minHeight = Math.max(MIN_VISIBLE_VIEWPORT_PX, viewportH * MIN_VISIBLE_VIEWPORT_RATIO)
  if (width < minWidth || height < minHeight) return fallback
  return normalizeViewportFrame({ viewportW, viewportH, left, top, width, height })
}

export function resolveWorkspaceVisibleViewport(args: {
  viewportW: number
  viewportH: number
  workspaceEditorOverlayOpen?: boolean
  surfaceElement?: Element | null
  ownerDocument?: Document | null
}): ViewportFrame {
  const viewportW = Math.max(1, Math.floor(isFiniteNumber(args.viewportW) ? args.viewportW : 1))
  const viewportH = Math.max(1, Math.floor(isFiniteNumber(args.viewportH) ? args.viewportH : 1))
  const fallback = normalizeViewportFrame({ viewportW, viewportH })
  if (args.workspaceEditorOverlayOpen !== true) return fallback
  if (typeof document === 'undefined' && !args.ownerDocument) return fallback

  const ownerDocument = args.ownerDocument || args.surfaceElement?.ownerDocument || document
  const surfaceRect = args.surfaceElement
    ? rectFromDomRect(args.surfaceElement.getBoundingClientRect())
    : null
  const occluderRects = Array.from(ownerDocument.querySelectorAll<HTMLElement>(`[${WORKSPACE_VISIBLE_VIEWPORT_OCCLUDER_ATTR}]`))
    .map(el => rectFromDomRect(el.getBoundingClientRect()))
    .filter(isUsableRect)
  return resolveWorkspaceVisibleViewportFromOccluders({
    viewportW,
    viewportH,
    workspaceEditorOverlayOpen: true,
    surfaceRect,
    occluderRects,
  })
}
