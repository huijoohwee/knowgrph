import type { GraphData, GraphNode } from '@/lib/graph/types'
import { resolvePreferredRichMediaPanelNodeId } from '@/lib/render/richMediaSsot'

export type GrabMapsPoiRichMediaDetail = {
  label: string
  lng: number
  lat: number
  address?: string
  category?: string
}

export type GrabMapsPoiRichMediaPreviewPayload = {
  targetNodeId: string
  srcDoc: string
  label: string
}

export const GRABMAPS_POI_RICH_MEDIA_PREVIEW_EVENT = 'kg:grabmaps:poi-rich-media-preview'

let latestGrabMapsPoiRichMediaPreviewPayload: GrabMapsPoiRichMediaPreviewPayload | null = null

function readGraphNodes(graphData: GraphData | null | undefined): GraphNode[] {
  return Array.isArray(graphData?.nodes) ? graphData.nodes : []
}

export function resolveGrabMapsPoiRichMediaPanelNodeId(args: {
  graphData: GraphData | null | undefined
  selectedNodeId?: string | null
  selectedNodeIds?: readonly string[]
  openWidgetNodeIds?: readonly string[]
  flowEditorOpenWidgetNodeIds?: readonly string[]
}): string {
  const nodes = readGraphNodes(args.graphData)
  if (nodes.length === 0) return ''
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!
    const id = String(node.id || '').trim()
    if (!id) continue
    nodeById.set(id, node)
  }
  return resolvePreferredRichMediaPanelNodeId({
    graphData: args.graphData,
    selectedNodeId: args.selectedNodeId,
    selectedNodeIds: args.selectedNodeIds,
    openWidgetNodeIds: args.openWidgetNodeIds,
    flowEditorOpenWidgetNodeIds: args.flowEditorOpenWidgetNodeIds,
    nodeById,
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildGrabMapsPoiRichMediaSrcDoc(detail: GrabMapsPoiRichMediaDetail): string {
  const label = escapeHtml(String(detail.label || '').trim() || 'POI')
  const lat = Number(detail.lat)
  const lng = Number(detail.lng)
  const address = escapeHtml(String(detail.address || '').trim())
  const category = escapeHtml(String(detail.category || '').trim())
  const coordText =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      : ''
  const metaRows = [
    address ? `<div><strong>Address</strong><span>${address}</span></div>` : '',
    category ? `<div><strong>Category</strong><span>${category}</span></div>` : '',
    coordText ? `<div><strong>Coordinates</strong><span>${coordText}</span></div>` : '',
  ].filter(Boolean).join('')
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    '<style>',
    'html,body{margin:0;padding:0;background:#f8fafc;color:#0f172a;font:14px/1.45 ui-sans-serif,system-ui,sans-serif;}',
    'main{min-height:100vh;box-sizing:border-box;padding:18px;display:flex;align-items:flex-start;justify-content:center;}',
    'article{width:100%;max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 28px rgba(15,23,42,.08);padding:16px 18px;}',
    'h1{margin:0;font-size:20px;line-height:1.25;}',
    'p{margin:8px 0 0;color:#475569;}',
    'section{margin-top:16px;display:grid;gap:10px;}',
    'section div{display:grid;gap:2px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;}',
    'strong{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#64748b;}',
    'span{font-size:14px;color:#0f172a;word-break:break-word;}',
    '</style></head><body>',
    `<main><article><h1>${label}</h1><p>GrabMaps POI selection rendered on the Rich Media Panel surface.</p>`,
    metaRows ? `<section>${metaRows}</section>` : '',
    '</article></main></body></html>',
  ].join('')
}

export function publishGrabMapsPoiRichMediaPreview(payload: GrabMapsPoiRichMediaPreviewPayload): void {
  latestGrabMapsPoiRichMediaPreviewPayload = payload
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(GRABMAPS_POI_RICH_MEDIA_PREVIEW_EVENT, { detail: payload }))
  } catch {
    void 0
  }
}

export function readLatestGrabMapsPoiRichMediaPreview(): GrabMapsPoiRichMediaPreviewPayload | null {
  return latestGrabMapsPoiRichMediaPreviewPayload
}
