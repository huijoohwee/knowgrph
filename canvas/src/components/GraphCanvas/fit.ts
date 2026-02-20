import * as d3 from 'd3';
import { GraphNode } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import { getNodeRectDimensions2d } from '@/components/GraphCanvas/nodeSizing2d';
import {
  DEFAULT_FIT_PADDING,
  DEFAULT_ZOOM_MAX_SCALE,
  DEFAULT_ZOOM_MAX_SCALE_HARD_CAP,
  DEFAULT_ZOOM_MIN_SCALE,
  computeFitFrame,
  clampFillRatio,
  clampScaleToExtent,
  ZOOM_VIEWPORT_PRESET_16_9,
} from 'grph-shared/zoom/presets'

export const fitNodeTransform = (n: GraphNode, width: number, height: number) => {
  const s = 1.5;
  return d3.zoomIdentity.translate(width / 2 - s * (n.x || 0), height / 2 - s * (n.y || 0)).scale(s);
};

export const fitEdgeTransform = (src: GraphNode, tgt: GraphNode, width: number, height: number) => {
  const pad = DEFAULT_FIT_PADDING;
  const minX = Math.min(src.x || 0, tgt.x || 0);
  const maxX = Math.max(src.x || 0, tgt.x || 0);
  const minY = Math.min(src.y || 0, tgt.y || 0);
  const maxY = Math.max(src.y || 0, tgt.y || 0);
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const sX = (width - 2 * pad) / boxW;
  const sY = (height - 2 * pad) / boxH;
  const s = Math.max(DEFAULT_ZOOM_MIN_SCALE, Math.min(DEFAULT_ZOOM_MAX_SCALE, Math.min(sX, sY, 3)));
  const cx = ((src.x || 0) + (tgt.x || 0)) / 2;
  const cy = ((src.y || 0) + (tgt.y || 0)) / 2;
  return d3.zoomIdentity.translate(width / 2 - s * cx, height / 2 - s * cy).scale(s);
};

export type FitAllTransformOptions = {
  pad?: number
  targetFillRatio?: number
  enforceAspectRatio?: boolean
  targetAspectRatio?: number
  minScale?: number
  maxScale?: number
  maxScaleHardCap?: number
  minBBoxSize?: number
  useCentroidCentering?: boolean
  detectClusters?: boolean
  nodePadding?: number
  schema?: GraphSchema
}

export const fitAllTransform = (
  nodes: GraphNode[],
  width: number,
  height: number,
  padOrOptions: number | FitAllTransformOptions = DEFAULT_FIT_PADDING,
) => {
  if (!nodes || nodes.length === 0) {
    return d3.zoomIdentity;
  }
  
  const opts: FitAllTransformOptions =
    typeof padOrOptions === 'number'
      ? { pad: padOrOptions }
      : (padOrOptions || {})

  const enforceAspectRatio = opts.enforceAspectRatio !== false
  const targetAspectRatio =
    typeof opts.targetAspectRatio === 'number' && Number.isFinite(opts.targetAspectRatio) && opts.targetAspectRatio > 0
      ? opts.targetAspectRatio
      : (width / Math.max(1, height))
  const minScale =
    typeof opts.minScale === 'number' && Number.isFinite(opts.minScale) ? opts.minScale : DEFAULT_ZOOM_MIN_SCALE
  const maxScale =
    typeof opts.maxScale === 'number' && Number.isFinite(opts.maxScale) ? opts.maxScale : DEFAULT_ZOOM_MAX_SCALE
  const maxScaleHardCap =
    typeof opts.maxScaleHardCap === 'number' && Number.isFinite(opts.maxScaleHardCap)
      ? opts.maxScaleHardCap
      : DEFAULT_ZOOM_MAX_SCALE_HARD_CAP
  const minBBoxSize = typeof opts.minBBoxSize === 'number' && Number.isFinite(opts.minBBoxSize) ? opts.minBBoxSize : 100
  const useCentroidCentering = opts.useCentroidCentering !== false
  const detectClusters = opts.detectClusters === true
  const nodePaddingRaw = typeof opts.nodePadding === 'number' && Number.isFinite(opts.nodePadding) ? opts.nodePadding : 12
  const nodePadding = Math.max(0, nodePaddingRaw)
  const schema = opts.schema

  const validNodes = nodes.filter(n => typeof n.x === 'number' && Number.isFinite(n.x) && typeof n.y === 'number' && Number.isFinite(n.y))

  if (validNodes.length === 0) {
    return d3.zoomIdentity
  }

  const quantileSorted = (sorted: number[], q: number): number => {
    if (sorted.length === 0) return 0
    const qq = Math.max(0, Math.min(1, q))
    const pos = (sorted.length - 1) * qq
    const base = Math.floor(pos)
    const rest = pos - base
    const a = sorted[base]!
    const b = sorted[Math.min(sorted.length - 1, base + 1)]!
    return a + rest * (b - a)
  }

  const clusterFilteredNodes = (() => {
    if (!detectClusters) return validNodes
    if (validNodes.length < 20) return validNodes

    const xs = validNodes.map(n => n.x as number).sort((a, b) => a - b)
    const ys = validNodes.map(n => n.y as number).sort((a, b) => a - b)
    const mx = quantileSorted(xs, 0.5)
    const my = quantileSorted(ys, 0.5)

    const withD2 = validNodes.map(n => {
      const dx = (n.x as number) - mx
      const dy = (n.y as number) - my
      return { n, d2: dx * dx + dy * dy }
    })
    const d2s = withD2.map(v => v.d2).sort((a, b) => a - b)

    const cut95 = quantileSorted(d2s, 0.95)
    let kept = withD2.filter(v => v.d2 <= cut95).map(v => v.n)
    if (kept.length < Math.max(10, Math.floor(validNodes.length * 0.5))) {
      const cut98 = quantileSorted(d2s, 0.98)
      kept = withD2.filter(v => v.d2 <= cut98).map(v => v.n)
    }
    return kept.length >= 5 ? kept : validNodes
  })()

  const nodesForFit = clusterFilteredNodes

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let validCount = 0;

  for (let i = 0; i < nodesForFit.length; i += 1) {
    const n = nodesForFit[i];
    const x = n.x!;
    const y = n.y!;

    const dim = (() => {
      const props = (n.properties || {}) as Record<string, unknown>
      const visualW = props['visual:width']
      const visualH = props['visual:height']
      const vw = typeof visualW === 'number' && Number.isFinite(visualW) && visualW > 0 ? visualW : null
      const vh = typeof visualH === 'number' && Number.isFinite(visualH) && visualH > 0 ? visualH : null
      if (vw != null && vh != null) return { width: vw, height: vh }
      if (schema) return getNodeRectDimensions2d(n, schema)
      return null
    })()
    const hw = dim ? dim.width / 2 : 20
    const hh = dim ? dim.height / 2 : 20
    
    // For centroid, use node center
    sumX += x;
    sumY += y;
    validCount += 1;

    // For bounding box, include node dimensions + padding
    const left = x - hw - nodePadding
    const right = x + hw + nodePadding
    const top = y - hh - nodePadding
    const bottom = y + hh + nodePadding

    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }

  // If we only have 1 node or very tight cluster, ensure minimum box size
  if (maxX - minX < minBBoxSize) {
    const cx = (minX + maxX) / 2
    minX = cx - minBBoxSize / 2
    maxX = cx + minBBoxSize / 2
  }
  if (maxY - minY < minBBoxSize) {
    const cy = (minY + maxY) / 2
    minY = cy - minBBoxSize / 2
    maxY = cy + minBBoxSize / 2
  }

  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const p = Math.max(
    20,
    (typeof opts.pad === 'number' && Number.isFinite(opts.pad) ? opts.pad : DEFAULT_FIT_PADDING) ?? DEFAULT_FIT_PADDING,
  );
  const targetFillRatioRaw = typeof opts.targetFillRatio === 'number' && Number.isFinite(opts.targetFillRatio) ? opts.targetFillRatio : null
  const targetFillRatio = targetFillRatioRaw == null ? null : clampFillRatio(targetFillRatioRaw)

  let bboxW = Math.max(maxX - minX, minBBoxSize);
  let bboxH = Math.max(maxY - minY, minBBoxSize);

  const { frameW, frameH } = targetFillRatio != null ? computeFitFrame(w, h, ZOOM_VIEWPORT_PRESET_16_9) : { frameW: w, frameH: h }
  const viewW = Math.max(1, frameW - p * 2);
  const viewH = Math.max(1, frameH - p * 2);

  if (enforceAspectRatio) {
    const viewRatio = viewW / viewH;
    const effectiveTargetRatio =
      Number.isFinite(targetAspectRatio) && targetAspectRatio > 0 ? targetAspectRatio : viewRatio
    const bboxRatio = bboxW / bboxH;
    
    if (Number.isFinite(effectiveTargetRatio) && Number.isFinite(bboxRatio) && effectiveTargetRatio > 0 && bboxRatio > 0) {
      if (bboxRatio > effectiveTargetRatio) {
        bboxH = Math.max(bboxH, bboxW / effectiveTargetRatio);
      } else {
        bboxW = Math.max(bboxW, bboxH * effectiveTargetRatio);
      }
    }
  }

  const cx = useCentroidCentering ? (validCount > 0 ? sumX / validCount : (minX + maxX) / 2) : (minX + maxX) / 2;
  const cy = useCentroidCentering ? (validCount > 0 ? sumY / validCount : (minY + maxY) / 2) : (minY + maxY) / 2;

  // Ensure minimum zoom scale to avoid tiny graph on large canvas
  const symmetricContentW = 2 * Math.max(cx - minX, maxX - cx)
  const symmetricContentH = 2 * Math.max(cy - minY, maxY - cy)
  const contentW = Math.max(minBBoxSize, useCentroidCentering ? symmetricContentW : (maxX - minX))
  const contentH = Math.max(minBBoxSize, useCentroidCentering ? symmetricContentH : (maxY - minY))
  
  const sX = (targetFillRatio != null ? (frameW * targetFillRatio) : viewW) / contentW;
  const sY = (targetFillRatio != null ? (frameH * targetFillRatio) : viewH) / contentH;

  const unclamped = Math.min(sX, sY)
  
  const fitScale = unclamped

  const s = clampScaleToExtent(fitScale, { minScale, maxScale, maxScaleHardCap })

  // Ensure content is centered
  const tx = w / 2 - s * cx
  const ty = h / 2 - s * cy

  return d3.zoomIdentity
    .translate(tx, ty)
    .scale(s);
};

export const fitSubsetTransform = (nodes: GraphNode[], width: number, height: number, pad: number = DEFAULT_FIT_PADDING) => {
  return fitAllTransform(nodes, width, height, typeof pad === 'number' ? { pad } : {})
};

export const centerAllTransform = (nodes: GraphNode[], width: number, height: number) => {
  const coords = nodes
    .map(n => [n.x, n.y] as const)
    .filter(([x, y]) => typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y));
  if (coords.length === 0) {
    return d3.zoomIdentity;
  }
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < coords.length; i += 1) {
    sumX += coords[i][0];
    sumY += coords[i][1];
  }
  const cx = coords.length > 0 ? sumX / coords.length : 0;
  const cy = coords.length > 0 ? sumY / coords.length : 0;
  return d3.zoomIdentity.translate(width / 2 - cx, height / 2 - cy).scale(1);
};

export const scaleCenteredOnGraphCentroidTransform = (
  nodes: GraphNode[],
  width: number,
  height: number,
  scale: number,
) => {
  const coords = nodes
    .map(n => [n.x, n.y] as const)
    .filter(([x, y]) => typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y))
  if (coords.length === 0) {
    return d3.zoomIdentity.scale(scale)
  }
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < coords.length; i += 1) {
    sumX += coords[i][0]
    sumY += coords[i][1]
  }
  const cx = sumX / coords.length
  const cy = sumY / coords.length
  const k = Math.max(0.001, scale)
  return d3.zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k)
}
