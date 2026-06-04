import { DEFAULT_ZOOM_MAX_SCALE, DEFAULT_ZOOM_MIN_SCALE } from 'grph-shared/zoom/presets'
import {
  computeTransformFromWorldCenter,
  computeTransformFromWorldTopLeft,
  type ZoomScaleExtentLike,
} from '@/lib/zoom/viewport'

export type MinimapBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
}

export type MinimapRect = {
  x: number
  y: number
  w: number
  h: number
}

export type MinimapPoint = {
  x: number
  y: number
}

export type MinimapNodeGeometry = {
  x?: number
  y?: number
  width?: number
  height?: number
}

export const MINIMAP_HEIGHT = 120
export const MINIMAP_WIDTH = Math.round((MINIMAP_HEIGHT * 16) / 9)
export const MINIMAP_GRAPH_PAD_DEFAULT = 20
export const MINIMAP_NODE_SIZE_DEFAULT = 3
export const MINIMAP_OVERLAY_NODE_SIZE_DEFAULT = 2
export const MINIMAP_SELECTED_NODE_SIZE_DEFAULT = 4
export const MINIMAP_NEIGHBOR_NODE_SIZE_DEFAULT = MINIMAP_NODE_SIZE_DEFAULT
export const MINIMAP_EDGE_LIMIT_DEFAULT = 20000
export const MINIMAP_NODE_LIMIT_DEFAULT = 25000

const finiteNumberOrNull = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const positiveFiniteNumberOrNull = (value: unknown): number | null => {
  const n = finiteNumberOrNull(value)
  return n != null && n > 0 ? n : null
}

export const computeViewRect = (vw: number, vh: number, k: number, x: number, y: number, sx: number) => {
  const kk = Math.max(1e-6, k)
  const x0 = (0 - x) / kk
  const y0 = (0 - y) / kk
  const w0 = vw / kk
  const h0 = vh / kk
  return { x: x0 * sx, y: y0 * sx, w: w0 * sx, h: h0 * sx }
}

export const computeMinimapViewportWorldRect = (
  vw: number,
  vh: number,
  k: number,
  x: number,
  y: number,
): MinimapRect => {
  return computeViewRect(vw, vh, k, x, y, 1)
}

export const readMinimapNodeExtent = (node: MinimapNodeGeometry | null | undefined): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} | null => {
  const x = finiteNumberOrNull(node?.x)
  const y = finiteNumberOrNull(node?.y)
  if (x == null || y == null) return null

  const width = positiveFiniteNumberOrNull(node?.width)
  const height = positiveFiniteNumberOrNull(node?.height)
  if (width != null && height != null) {
    return {
      minX: x,
      maxX: x + width,
      minY: y,
      maxY: y + height,
    }
  }

  return { minX: x, maxX: x, minY: y, maxY: y }
}

export const readMinimapNodeCenter = (node: MinimapNodeGeometry | null | undefined): MinimapPoint | null => {
  const extent = readMinimapNodeExtent(node)
  if (!extent) return null
  return {
    x: (extent.minX + extent.maxX) / 2,
    y: (extent.minY + extent.maxY) / 2,
  }
}

export const computeGraphBounds = (nodes: Array<MinimapNodeGeometry>, pad: number = 0): MinimapBounds => {
  if (!nodes || nodes.length === 0) {
    const width = Math.max(1, pad * 2)
    const height = Math.max(1, pad * 2)
    return { minX: -pad, maxX: pad, minY: -pad, maxY: pad, width, height }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let count = 0
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const extent = readMinimapNodeExtent(n)
    if (!extent) continue
    count += 1
    if (extent.minX < minX) minX = extent.minX
    if (extent.maxX > maxX) maxX = extent.maxX
    if (extent.minY < minY) minY = extent.minY
    if (extent.maxY > maxY) maxY = extent.maxY
  }
  if (count === 0 || !isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    minX = -pad; maxX = pad; minY = -pad; maxY = pad
  }
  const width = Math.max(1, (maxX - minX) || 1)
  const height = Math.max(1, (maxY - minY) || 1)
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad, width: width + pad * 2, height: height + pad * 2 }
}

export const unionMinimapBoundsWithRect = (bounds: MinimapBounds, rect: MinimapRect): MinimapBounds => {
  const minX = Math.min(bounds.minX, rect.x)
  const minY = Math.min(bounds.minY, rect.y)
  const maxX = Math.max(bounds.maxX, rect.x + rect.w)
  const maxY = Math.max(bounds.maxY, rect.y + rect.h)
  if (minX === bounds.minX && minY === bounds.minY && maxX === bounds.maxX && maxY === bounds.maxY) {
    return bounds
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

export const computeMinimapProjection = (
  bounds: MinimapBounds,
  size: { w: number; h: number },
): { sx: number; scaleX: number; scaleY: number } => {
  const w = Math.max(1, finiteNumberOrNull(size.w) ?? MINIMAP_WIDTH)
  const h = Math.max(1, finiteNumberOrNull(size.h) ?? MINIMAP_HEIGHT)
  const scaleX = w / Math.max(1, bounds.width)
  const scaleY = h / Math.max(1, bounds.height)
  return {
    sx: Math.min(scaleX, scaleY),
    scaleX,
    scaleY,
  }
}

export const projectWorldPointToMinimap = (
  point: MinimapPoint,
  bounds: Pick<MinimapBounds, 'minX' | 'minY'>,
  sx: number,
): MinimapPoint => ({
  x: (point.x - bounds.minX) * sx,
  y: (point.y - bounds.minY) * sx,
})

export const projectMinimapPointToWorld = (
  point: MinimapPoint,
  bounds: Pick<MinimapBounds, 'minX' | 'minY'>,
  sx: number,
): MinimapPoint => {
  const scale = Math.max(1e-6, sx)
  return {
    x: point.x / scale + bounds.minX,
    y: point.y / scale + bounds.minY,
  }
}

export const projectWorldRectToMinimap = (
  rect: MinimapRect,
  bounds: Pick<MinimapBounds, 'minX' | 'minY'>,
  sx: number,
): MinimapRect => {
  const point = projectWorldPointToMinimap({ x: rect.x, y: rect.y }, bounds, sx)
  return {
    x: point.x,
    y: point.y,
    w: rect.w * sx,
    h: rect.h * sx,
  }
}

export const computeTransformFromViewTopLeft = (
  vw: number,
  vh: number,
  k: number,
  gx: number,
  gy: number
) => {
  return computeTransformFromWorldTopLeft({
    viewportW: vw,
    viewportH: vh,
    worldX: gx,
    worldY: gy,
    k,
  });
}

export const buildCoordMap = (nodes: Array<{ id: string; x?: number; y?: number }>) => {
  const map: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    map[n.id] = { x: Number(n.x ?? 0), y: Number(n.y ?? 0) };
  }
  return map;
};

export const clampZoomScale = (k: number, minScale: number, maxScale: number) => {
  const kk = Number.isFinite(k) ? k : 1
  const min = Number.isFinite(minScale) ? minScale : DEFAULT_ZOOM_MIN_SCALE
  const max = Number.isFinite(maxScale) ? maxScale : DEFAULT_ZOOM_MAX_SCALE
  return Math.max(min, Math.min(max, kk))
}

export const computeTransformFromCenter = (
  vw: number,
  vh: number,
  ux: number,
  uy: number,
  k: number,
  scaleExtent: { minScale: number; maxScale: number }
) => {
  const extent: ZoomScaleExtentLike = {
    minScale: scaleExtent.minScale,
    maxScale: scaleExtent.maxScale,
  }
  return computeTransformFromWorldCenter({
    viewportW: vw,
    viewportH: vh,
    worldX: ux,
    worldY: uy,
    k,
    scaleExtent: extent,
  });
}
