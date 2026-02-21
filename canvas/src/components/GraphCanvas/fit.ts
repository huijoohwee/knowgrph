import * as d3 from 'd3';
import { GraphNode, type GraphData } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import { getNodeRectDimensions2d } from '@/components/GraphCanvas/nodeSizing2d';
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { DEFAULT_GROUP_NESTED_PADDING_STEP } from '@/lib/graph/layoutDefaults'
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

export const coerceNodesForFit = (args: {
  nodes: GraphNode[]
  coords: 'center' | 'topLeft'
  defaultW?: number
  defaultH?: number
  setVisualRect?: boolean
}): GraphNode[] => {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const coords = args.coords === 'topLeft' ? 'topLeft' : 'center'
  const setVisualRect = args.setVisualRect !== false
  const w = typeof args.defaultW === 'number' && Number.isFinite(args.defaultW) && args.defaultW > 0 ? args.defaultW : null
  const h = typeof args.defaultH === 'number' && Number.isFinite(args.defaultH) && args.defaultH > 0 ? args.defaultH : null

  const out: GraphNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!n) continue
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    const props = (n.properties || {}) as Record<string, unknown>
    const hasVisualW = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) && (props['visual:width'] as number) > 0
    const hasVisualH = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) && (props['visual:height'] as number) > 0
    const nextProps = setVisualRect
      ? {
          ...props,
          ...(hasVisualW || w == null ? null : { 'visual:width': w }),
          ...(hasVisualH || h == null ? null : { 'visual:height': h }),
          'visual:shape': typeof props['visual:shape'] === 'string' ? props['visual:shape'] : 'rect',
        }
      : props

    if (coords === 'topLeft' && x != null && y != null && w != null && h != null) {
      out.push({
        ...n,
        x: x + w / 2,
        y: y + h / 2,
        properties: nextProps as unknown as GraphNode['properties'],
      })
      continue
    }

    if (setVisualRect && nextProps !== props) {
      out.push({ ...n, properties: nextProps as unknown as GraphNode['properties'] })
    } else {
      out.push(n)
    }
  }
  return out
}

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
  centerMode?: 'bbox' | 'centroid'
  detectClusters?: boolean
  nodePadding?: number
  schema?: GraphSchema
  graphData?: GraphData
  includeGroupsBounds?: boolean
  deriveGroupsOptions?: { forceDocumentStructure?: boolean }
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
  const centerMode = opts.centerMode === 'bbox' || opts.centerMode === 'centroid'
    ? opts.centerMode
    : (opts.useCentroidCentering !== false ? 'centroid' : 'bbox')
  const useCentroidCentering = centerMode === 'centroid'
  const detectClusters = opts.detectClusters === true
  const nodePaddingRaw = typeof opts.nodePadding === 'number' && Number.isFinite(opts.nodePadding) ? opts.nodePadding : 12
  const nodePadding = Math.max(0, nodePaddingRaw)
  const schema = opts.schema
  const graphData = opts.graphData
  const includeGroupsBounds = opts.includeGroupsBounds !== false

  const coerceFiniteNumber = (v: unknown): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    return v
  }

  const readNodeXY = (n: GraphNode): { x: number; y: number } | null => {
    const x = coerceFiniteNumber((n as unknown as { x?: unknown }).x)
    const y = coerceFiniteNumber((n as unknown as { y?: unknown }).y)
    if (x != null && y != null) return { x, y }
    const fx = coerceFiniteNumber((n as unknown as { fx?: unknown }).fx)
    const fy = coerceFiniteNumber((n as unknown as { fy?: unknown }).fy)
    if (fx != null && fy != null) return { x: fx, y: fy }
    return null
  }

  const validNodes = nodes.filter(n => !!readNodeXY(n))

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

    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < validNodes.length; i += 1) {
      const xy = readNodeXY(validNodes[i])
      if (!xy) continue
      xs.push(xy.x)
      ys.push(xy.y)
    }
    xs.sort((a, b) => a - b)
    ys.sort((a, b) => a - b)
    const mx = quantileSorted(xs, 0.5)
    const my = quantileSorted(ys, 0.5)

    const withD2 = validNodes.map(n => {
      const xy = readNodeXY(n)
      const dx = (xy?.x ?? 0) - mx
      const dy = (xy?.y ?? 0) - my
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

  const nodeHalfExtentsForFit = (n: GraphNode): { halfW: number; halfH: number } => {
    const props = (n.properties || {}) as Record<string, unknown>
    const visualW = props['visual:width']
    const visualH = props['visual:height']
    const vw = typeof visualW === 'number' && Number.isFinite(visualW) && visualW > 0 ? visualW : null
    const vh = typeof visualH === 'number' && Number.isFinite(visualH) && visualH > 0 ? visualH : null

    let hw = 20
    let hh = 20
    if (schema) {
      const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
      hw = Math.max(hw, ext.halfW)
      hh = Math.max(hh, ext.halfH)

      const dim = getNodeRectDimensions2d(n, schema)
      hw = Math.max(hw, dim.width / 2)
      hh = Math.max(hh, dim.height / 2)
    }

    if (vw != null) hw = Math.max(hw, vw / 2)
    if (vh != null) hh = Math.max(hh, vh / 2)
    return { halfW: hw, halfH: hh }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let validCount = 0;

  for (let i = 0; i < nodesForFit.length; i += 1) {
    const n = nodesForFit[i];
    const xy = readNodeXY(n)
    if (!xy) continue
    const x = xy.x
    const y = xy.y

    const ext = nodeHalfExtentsForFit(n)
    const hw = ext.halfW
    const hh = ext.halfH
    
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

  if (includeGroupsBounds && graphData && schema) {
    const groupCfg = schema.layout?.groups || {}
    // If groups are disabled in schema, but we explicitly requested to include them (e.g. forced mode),
    // we proceed. Otherwise we respect the schema.
    if (groupCfg.enabled === false && !opts.deriveGroupsOptions?.forceDocumentStructure) {
       // skip
    } else {
    const paddingRaw = (groupCfg as unknown as { padding?: number }).padding
    const labelPaddingRaw = (groupCfg as unknown as { labelPadding?: number }).labelPadding
    const nestedPaddingStepRaw = (groupCfg as unknown as { nestedPaddingStep?: number }).nestedPaddingStep
    const padding = typeof paddingRaw === 'number' && Number.isFinite(paddingRaw) ? Math.max(0, paddingRaw) : 24
    const labelPadding = typeof labelPaddingRaw === 'number' && Number.isFinite(labelPaddingRaw) ? Math.max(0, labelPaddingRaw) : 10
    const nestedPaddingStep = typeof nestedPaddingStepRaw === 'number' && Number.isFinite(nestedPaddingStepRaw)
      ? Math.max(0, nestedPaddingStepRaw)
      : DEFAULT_GROUP_NESTED_PADDING_STEP
    const baseFontSize = schema.labelStyles?.fontSize ?? 12

    const nodeById = new Map<string, GraphNode>()
    const nodesForFitIdSet = new Set<string>()
    for (let i = 0; i < nodesForFit.length; i += 1) {
      const n = nodesForFit[i]
      const id = String(n.id || '')
      if (!id) continue
      nodeById.set(id, n)
      nodesForFitIdSet.add(id)
    }

    const groups = deriveGraphGroups(graphData, opts.deriveGroupsOptions)
    if (groups.length > 0) {
      let maxDepth = 0
      for (let i = 0; i < groups.length; i += 1) {
        const d = groups[i]
        const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
        maxDepth = Math.max(maxDepth, depth)
      }

      for (let gi = 0; gi < groups.length; gi += 1) {
        const g = groups[gi]
        const depth = typeof g.depth === 'number' && Number.isFinite(g.depth) ? Math.max(0, Math.floor(g.depth)) : 0
        const extraPad = nestedPaddingStep > 0 ? nestedPaddingStep * Math.max(0, maxDepth - depth) : 0
        const effectivePadding = padding + extraPad
        const fontSize = Math.max(12, Math.min(24, baseFontSize + Math.min(12, depth * 2)))
        const topPad = effectivePadding + labelPadding + fontSize * 1.25

        let gMinX = Infinity
        let gMaxX = -Infinity
        let gMinY = Infinity
        let gMaxY = -Infinity
        let valid = 0

        const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
        for (let mi = 0; mi < members.length; mi += 1) {
          const id = String(members[mi] || '')
          if (!id || !nodesForFitIdSet.has(id)) continue
          const n = nodeById.get(id)
          if (!n) continue
          const xy = readNodeXY(n)
          if (!xy) continue
          const ext = nodeHalfExtentsForFit(n)
          const x0 = xy.x - ext.halfW
          const x1 = xy.x + ext.halfW
          const y0 = xy.y - ext.halfH
          const y1 = xy.y + ext.halfH
          if (x0 < gMinX) gMinX = x0
          if (x1 > gMaxX) gMaxX = x1
          if (y0 < gMinY) gMinY = y0
          if (y1 > gMaxY) gMaxY = y1
          valid += 1
        }

        if (valid === 0 || gMinX === Infinity) continue
        const left = gMinX - effectivePadding
        const right = gMaxX + effectivePadding
        const top = gMinY - topPad
        const bottom = gMaxY + effectivePadding

        if (left < minX) minX = left
        if (right > maxX) maxX = right
        if (top < minY) minY = top
        if (bottom > maxY) maxY = bottom

        if (useCentroidCentering) {
          sumX += (left + right) / 2
          sumY += (top + bottom) / 2
          validCount += 1
        }
      }
    }
    }
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
