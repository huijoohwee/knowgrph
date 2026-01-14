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

  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const p = Math.max(20, pad ?? 80);

  // Enforce minimum bounding box dimensions to prevent "one-line" infinite zoom
  // or edge-hugging layouts.
  const bboxW = Math.max(maxX - minX, 100);
  const bboxH = Math.max(maxY - minY, 100);

  // Calculate center of the bounding box
  const cx = minX + (maxX - minX) / 2;
  const cy = minY + (maxY - minY) / 2;

  const sX = (w - p * 2) / bboxW;
  const sY = (h - p * 2) / bboxH;

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
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const sX = (width - 2 * pad) / boxW;
  const sY = (height - 2 * pad) / boxH;
  const s = Math.max(0.1, Math.min(4, Math.min(sX, sY, 3)));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return d3.zoomIdentity.translate(width / 2 - s * cx, height / 2 - s * cy).scale(s);
};

export const centerAllTransform = (nodes: GraphNode[], width: number, height: number) => {
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
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return d3.zoomIdentity.translate(width / 2 - cx, height / 2 - cy).scale(1);
};
