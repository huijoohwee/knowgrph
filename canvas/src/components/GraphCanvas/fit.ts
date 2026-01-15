import * as d3 from 'd3';
import { GraphNode } from '@/lib/graph/types';

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

export const fitAllTransform = (nodes: GraphNode[], width: number, height: number, pad: number = 80) => {
  if (!nodes || nodes.length === 0) {
    return d3.zoomIdentity;
  }
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasValid = false;
  let sumX = 0;
  let sumY = 0;
  let validCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const x = n.x;
    const y = n.y;
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) continue;
    
    hasValid = true;
    sumX += x;
    sumY += y;
    validCount += 1;
    
    // Estimate node bounds to prevent edge clipping
    let halfW = 20; // Default radius-ish
    let halfH = 20;
    
    const props = n.properties as Record<string, unknown> | undefined;
    if (props) {
        const vw = props['visual:width'];
        const vh = props['visual:height'];
        if (typeof vw === 'number' && Number.isFinite(vw) && vw > 0) halfW = vw / 2;
        if (typeof vh === 'number' && Number.isFinite(vh) && vh > 0) halfH = vh / 2;
    }
    
    if (x - halfW < minX) minX = x - halfW;
    if (x + halfW > maxX) maxX = x + halfW;
    if (y - halfH < minY) minY = y - halfH;
    if (y + halfH > maxY) maxY = y + halfH;
  }

  if (!hasValid) {
    return d3.zoomIdentity;
  }

  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const p = Math.max(20, pad ?? 80);

  // Enforce minimum bounding box dimensions to prevent "one-line" infinite zoom
  // or edge-hugging layouts.
  let bboxW = Math.max(maxX - minX, 100);
  let bboxH = Math.max(maxY - minY, 100);

  const viewW = Math.max(1, w - p * 2);
  const viewH = Math.max(1, h - p * 2);
  const viewRatio = viewW / viewH;
  const bboxRatio = bboxW / bboxH;
  if (Number.isFinite(viewRatio) && Number.isFinite(bboxRatio) && viewRatio > 0 && bboxRatio > 0) {
    if (bboxRatio > viewRatio) {
      bboxH = Math.max(bboxH, bboxW / viewRatio);
    } else {
      bboxW = Math.max(bboxW, bboxH * viewRatio);
    }
  }

  const cx = validCount > 0 ? sumX / validCount : minX + (maxX - minX) / 2;
  const cy = validCount > 0 ? sumY / validCount : minY + (maxY - minY) / 2;

  const sX = viewW / bboxW;
  const sY = viewH / bboxH;

  const s = Math.max(0.1, Math.min(4, Math.min(sX, sY, 3)));

  // Center the bounding box in the viewport
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
