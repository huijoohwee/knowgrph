import * as d3 from 'd3';
import { GraphNode } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d';
import { estimateNodeLabelAabbHalfExtents2d } from '@/components/GraphCanvas/labelLayout2d'

export const fitNodeTransform = (n: GraphNode, width: number, height: number) => {
  const s = 1.5;
  return d3.zoomIdentity.translate(width / 2 - s * (n.x || 0), height / 2 - s * (n.y || 0)).scale(s);
};

export const fitEdgeTransform = (src: GraphNode, tgt: GraphNode, width: number, height: number) => {
  const pad = 80;
  const minX = Math.min(src.x || 0, tgt.x || 0);
  const maxX = Math.max(src.x || 0, tgt.x || 0);
  const minY = Math.min(src.y || 0, tgt.y || 0);
  const maxY = Math.max(src.y || 0, tgt.y || 0);
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const sX = (width - 2 * pad) / boxW;
  const sY = (height - 2 * pad) / boxH;
  const s = Math.max(0.1, Math.min(4, Math.min(sX, sY, 3)));
  const cx = ((src.x || 0) + (tgt.x || 0)) / 2;
  const cy = ((src.y || 0) + (tgt.y || 0)) / 2;
  return d3.zoomIdentity.translate(width / 2 - s * cx, height / 2 - s * cy).scale(s);
};

export type FitAllTransformOptions = {
  pad?: number
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
  padOrOptions: number | FitAllTransformOptions = 80,
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
      : (1920 / 1080)
  const minScale = typeof opts.minScale === 'number' && Number.isFinite(opts.minScale) ? opts.minScale : 0.1
  const maxScale = typeof opts.maxScale === 'number' && Number.isFinite(opts.maxScale) ? opts.maxScale : 4
  const maxScaleHardCap =
    typeof opts.maxScaleHardCap === 'number' && Number.isFinite(opts.maxScaleHardCap) ? opts.maxScaleHardCap : 6
  const minBBoxSize = typeof opts.minBBoxSize === 'number' && Number.isFinite(opts.minBBoxSize) ? opts.minBBoxSize : 100
  const useCentroidCentering = opts.useCentroidCentering !== false
  const detectClusters = opts.detectClusters === true
  const nodePaddingRaw = typeof opts.nodePadding === 'number' && Number.isFinite(opts.nodePadding) ? opts.nodePadding : 12
  const nodePadding = Math.max(0, Math.min(64, nodePaddingRaw))
  const schema = opts.schema

  let sumX = 0;
  let sumY = 0;
  let validCount = 0;
  const validNodes: GraphNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const x = n.x;
    const y = n.y;
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) continue;
    sumX += x;
    sumY += y;
    validCount += 1;
    validNodes.push(n);
  }

  if (validCount === 0) {
    return d3.zoomIdentity;
  }

  let nodesToFit = validNodes;
  if (detectClusters && validCount > 10) {
    const meanX = sumX / validCount;
    const meanY = sumY / validCount;
    
    let sumSqDiff = 0;
    for (let i = 0; i < validNodes.length; i++) {
        const dx = (validNodes[i].x || 0) - meanX;
        const dy = (validNodes[i].y || 0) - meanY;
        sumSqDiff += (dx * dx + dy * dy);
    }
    const stdDev = Math.sqrt(sumSqDiff / validCount);
    
    const threshold = stdDev * 2.5;
    const candidate = validNodes.filter(n => {
        const dx = (n.x || 0) - meanX;
        const dy = (n.y || 0) - meanY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= threshold;
    });

    const minKeep = Math.max(3, Math.floor(validNodes.length * 0.2));
    if (candidate.length >= minKeep) {
      nodesToFit = candidate;
      sumX = 0;
      sumY = 0;
      validCount = 0;
      for (let i = 0; i < nodesToFit.length; i++) {
          sumX += (nodesToFit[i].x || 0);
          sumY += (nodesToFit[i].y || 0);
          validCount++;
      }
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < nodesToFit.length; i++) {
    const n = nodesToFit[i];
    const x = n.x || 0;
    const y = n.y || 0;
    
    let halfW = 24 + nodePadding;
    let halfH = 24 + nodePadding;
    
    const props = n.properties as Record<string, unknown> | undefined;
    if (props) {
        const vw = props['visual:width'];
        const vh = props['visual:height'];
        if (typeof vw === 'number' && Number.isFinite(vw) && vw > 0) halfW = (vw / 2) + nodePadding;
        if (typeof vh === 'number' && Number.isFinite(vh) && vh > 0) halfH = (vh / 2) + nodePadding;
    }
    if (schema && (!props || (typeof props['visual:width'] !== 'number' && typeof props['visual:height'] !== 'number'))) {
      if (getNodeRenderShape2d(n, schema) !== 'circle') {
        const { width: rw, height: rh } = getNodeRectDimensions2d(n, schema)
        halfW = (rw / 2) + nodePadding
        halfH = (rh / 2) + nodePadding
      }
    }

    if (schema) {
      const withLabel = estimateNodeLabelAabbHalfExtents2d(n, schema, { halfW, halfH })
      halfW = withLabel.halfW
      halfH = withLabel.halfH
    }
    
    if (x - halfW < minX) minX = x - halfW;
    if (x + halfW > maxX) maxX = x + halfW;
    if (y - halfH < minY) minY = y - halfH;
    if (y + halfH > maxY) maxY = y + halfH;
  }

  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const p = Math.max(20, (typeof opts.pad === 'number' && Number.isFinite(opts.pad) ? opts.pad : 80) ?? 80);

  let bboxW = Math.max(maxX - minX, minBBoxSize);
  let bboxH = Math.max(maxY - minY, minBBoxSize);

  const frameW = Math.min(1920, w)
  const frameH = Math.min(1080, h)
  const viewW = Math.max(1, frameW - p * 2);
  const viewH = Math.max(1, frameH - p * 2);

  if (enforceAspectRatio) {
    const viewRatio = viewW / viewH;
    const effectiveTargetRatio = Math.abs(viewRatio - targetAspectRatio) < 0.1 ? targetAspectRatio : viewRatio;
    const bboxRatio = bboxW / bboxH;
    
    if (Number.isFinite(effectiveTargetRatio) && Number.isFinite(bboxRatio) && effectiveTargetRatio > 0 && bboxRatio > 0) {
      if (bboxRatio > effectiveTargetRatio) {
        bboxH = Math.max(bboxH, bboxW / effectiveTargetRatio);
      } else {
        bboxW = Math.max(bboxW, bboxH * effectiveTargetRatio);
      }
    }
  }

  const centroidX = validCount > 0 ? sumX / validCount : minX + (maxX - minX) / 2;
  const centroidY = validCount > 0 ? sumY / validCount : minY + (maxY - minY) / 2;
  const bboxCenterX = minX + (maxX - minX) / 2;
  const bboxCenterY = minY + (maxY - minY) / 2;

  const cx = useCentroidCentering ? centroidX : bboxCenterX;
  const cy = useCentroidCentering ? centroidY : bboxCenterY;

  const sX = viewW / bboxW;
  const sY = viewH / bboxH;

  const unclamped = Math.min(sX, sY)
  const upper = Math.min(Math.max(0.1, maxScale), Math.max(0.1, maxScaleHardCap))
  const lower = Math.max(0.01, Math.min(minScale, upper))
  const s = Math.max(lower, Math.min(upper, unclamped))

  return d3.zoomIdentity
    .translate(w / 2 - s * cx, h / 2 - s * cy)
    .scale(s);
};

export const fitSubsetTransform = (nodes: GraphNode[], width: number, height: number, pad: number = 80) => {
  if (!nodes || nodes.length === 0) {
    return d3.zoomIdentity;
  }
  const coords = nodes
    .map(n => [n.x, n.y] as const)
    .filter(([x, y]) => typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y));
  if (coords.length === 0) {
    return d3.zoomIdentity;
  }
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let boxW = Math.max(1, maxX - minX);
  let boxH = Math.max(1, maxY - minY);
  const p = Math.max(20, pad ?? 80);
  const viewW = Math.max(1, width - 2 * p);
  const viewH = Math.max(1, height - 2 * p);
  const viewRatio = viewW / viewH;
  const boxRatio = boxW / boxH;
  if (Number.isFinite(viewRatio) && Number.isFinite(boxRatio) && viewRatio > 0 && boxRatio > 0) {
    if (boxRatio > viewRatio) {
      boxH = Math.max(boxH, boxW / viewRatio);
    } else {
      boxW = Math.max(boxW, boxH * viewRatio);
    }
  }
  const sX = viewW / boxW;
  const sY = viewH / boxH;
  const s = Math.max(0.1, Math.min(4, Math.min(sX, sY, 3)));
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < coords.length; i += 1) {
    sumX += coords[i][0];
    sumY += coords[i][1];
  }
  const cx = coords.length > 0 ? sumX / coords.length : (minX + maxX) / 2;
  const cy = coords.length > 0 ? sumY / coords.length : (minY + maxY) / 2;
  return d3.zoomIdentity.translate(width / 2 - s * cx, height / 2 - s * cy).scale(s);
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
