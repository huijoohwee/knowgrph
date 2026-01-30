import { DEFAULT_ZOOM_MAX_SCALE, DEFAULT_ZOOM_MIN_SCALE } from 'grph-shared/zoom/presets'

export const computeViewRect = (vw: number, vh: number, k: number, x: number, y: number, sx: number) => {
  const kk = Math.max(1e-6, k)
  const x0 = (0 - x) / kk
  const y0 = (0 - y) / kk
  const w0 = vw / kk
  const h0 = vh / kk
  return { x: x0 * sx, y: y0 * sx, w: w0 * sx, h: h0 * sx }
}

export const computeGraphBounds = (nodes: Array<{ x?: number; y?: number }>, pad: number = 0) => {
  if (!nodes || nodes.length === 0) {
    const width = Math.max(1, pad * 2)
    const height = Math.max(1, pad * 2)
    return { minX: -pad, maxX: pad, minY: -pad, maxY: pad, width, height }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const x = Number(n.x ?? 0)
    const y = Number(n.y ?? 0)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    minX = -pad; maxX = pad; minY = -pad; maxY = pad
  }
  const width = Math.max(1, (maxX - minX) || 1)
  const height = Math.max(1, (maxY - minY) || 1)
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad, width: width + pad * 2, height: height + pad * 2 }
}

export const MINIMAP_HEIGHT = 120
export const MINIMAP_WIDTH = Math.round((MINIMAP_HEIGHT * 16) / 9)

export const computeTransformFromViewTopLeft = (
  vw: number,
  vh: number,
  k: number,
  gx: number,
  gy: number
) => {
  const kk = Math.max(1e-6, k);
  const w0 = vw / kk;
  const h0 = vh / kk;
  const cx = gx + w0 / 2;
  const cy = gy + h0 / 2;
  const x = -cx * kk + (vw / 2);
  const y = -cy * kk + (vh / 2);
  return { k: kk, x, y };
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
  const kk = clampZoomScale(k, scaleExtent.minScale, scaleExtent.maxScale)
  const x = -ux * kk + (vw / 2);
  const y = -uy * kk + (vh / 2);
  return { k: kk, x, y };
}
