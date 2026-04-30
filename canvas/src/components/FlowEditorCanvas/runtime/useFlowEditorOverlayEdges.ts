import React from 'react'

import { FLOW_HANDLE_DEFAULT_EDGE_ID, buildFlowHandleId, computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { type ToolMode, isRecord, pickString } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import {
  CANVAS_OVERLAY_PROXY_ROOT_SELECTOR,
  FLOW_EDITOR_INTERACTION_FRAME_EVENT,
  readCanvasOverlayNodeId,
  readFlowEditorOverlaySurfaceId,
} from '@/lib/canvas/flow-editor-overlay-proxy'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  pickDefaultFlowPortKey,
  readFlowEdgePortKey,
} from '@/lib/graph/flowPorts'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphEdge } from '@/lib/graph/types'
import {
  buildEdgePathD,
  ensureEdgeAnimationStyleElement,
  readEdgePathCurveOptions,
  readGlobalEdgeAnimationEnabled,
  readGlobalEdgeColor,
  readGlobalEdgeThicknessPx,
  readGlobalEdgeType,
} from '@/lib/graph/edgeTypes'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'
import { getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers'

function removeAllPaths(ref: React.MutableRefObject<Map<string, SVGPathElement>>) {
  for (const el of ref.current.values()) {
    try {
      el.remove()
    } catch {
      void 0
    }
  }
  ref.current.clear()
}

export function useFlowEditorOverlayEdges(args: {
  active: boolean
  overlayOnlyModeEnabled: boolean
  flowEditorSurfaceId: string
  rootRef: React.RefObject<HTMLElement | null>
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  overlayEditorNodeIdsRef: React.MutableRefObject<string[]>
  openWidgetNodeIdsRef: React.MutableRefObject<string[]>
  pendingOverlayNodeIdRef: React.MutableRefObject<string | null>
  widgetRegistryRef: React.MutableRefObject<ReadonlyArray<WidgetRegistryEntry>>
  schema: unknown
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  pendingEdgeSourcePortKey: string | null
  frontmatterFlowRenderSettings: { rankdir?: string } | null
}) {
  const schema = args.schema as GraphSchema
  const rankdir: 'LR' | 'TB' = args.frontmatterFlowRenderSettings?.rankdir === 'TB' ? 'TB' : 'LR'
  const overlayEdgesSvgRef = React.useRef<SVGSVGElement | null>(null)
  const overlayEdgePathByIdRef = React.useRef<Map<string, SVGPathElement>>(new Map())
  const overlayPendingEdgePathRef = React.useRef<SVGPathElement | null>(null)
  const overlayEdgeRafRef = React.useRef<number | null>(null)
  const overlayElByNodeIdRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const overlayEdgeSocketTypesRef = React.useRef<unknown>(null)
  const overlayEdgeSocketStyleByTypeRef = React.useRef<Map<string, { color: string; edgeWidthPx: number | null }>>(new Map())
  const overlayEdgeLayoutSigRef = React.useRef<string>('')
  const overlayEdgeAnchorCacheRef = React.useRef<Map<string, { x: number; y: number }>>(new Map())
  const lastStableOverlayEdgeNodeIdsRef = React.useRef<string[]>([])
  const overlayEdgeTopPctCacheRef = React.useRef<{
    key: string
    registry: ReadonlyArray<WidgetRegistryEntry> | null
    map: Map<string, Map<string, number>>
  } | null>(null)
  const pendingEdgePreviewRef = React.useRef<{ toolMode: ToolMode; sourceId: string | null; sourcePortKey: string | null }>({
    toolMode: 'select',
    sourceId: null,
    sourcePortKey: null,
  })
  const pendingEdgeCursorRef = React.useRef<null | { x: number; y: number; ts: number }>(null)

  React.useEffect(() => {
    pendingEdgePreviewRef.current = {
      toolMode: args.toolMode,
      sourceId: args.pendingEdgeSourceId ? String(args.pendingEdgeSourceId || '').trim() : null,
      sourcePortKey: args.pendingEdgeSourcePortKey ? String(args.pendingEdgeSourcePortKey || '').trim() : null,
    }
  }, [args.pendingEdgeSourceId, args.pendingEdgeSourcePortKey, args.toolMode])

  const scheduleOverlayEdgeUpdate = React.useCallback(() => {
    if (!args.active) return
    if (!args.overlayOnlyModeEnabled) return
    if (overlayEdgeRafRef.current != null) return
    overlayEdgeRafRef.current = requestAnimationFrame(() => {
      overlayEdgeRafRef.current = null
      const root = args.rootRef.current
      if (!root) return
      const svg = overlayEdgesSvgRef.current
      if (!svg) return
      const graph = args.draftGraphDataRef.current
      if (!graph) {
        removeAllPaths(overlayEdgePathByIdRef)
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        if (overlayPendingEdgePathRef.current) {
          try {
            overlayPendingEdgePathRef.current.remove()
          } catch {
            void 0
          }
          overlayPendingEdgePathRef.current = null
        }
        return
      }

      const rawNodes = Array.isArray(graph.nodes) ? (graph.nodes as Array<{ id?: unknown; type?: unknown; properties?: unknown }>) : []
      const rawEdges = Array.isArray(graph.edges)
        ? (graph.edges as Array<{ id?: unknown; source?: unknown; target?: unknown; type?: unknown; properties?: unknown }>)
        : []

      const socketStyleByType = (() => {
        const meta = (graph.metadata || {}) as Record<string, unknown>
        const st = meta.socketTypes
        if (st === overlayEdgeSocketTypesRef.current) return overlayEdgeSocketStyleByTypeRef.current
        overlayEdgeSocketTypesRef.current = st
        const next = new Map<string, { color: string; edgeWidthPx: number | null }>()
        if (!isRecord(st)) {
          overlayEdgeSocketStyleByTypeRef.current = next
          return next
        }
        for (const k of Object.keys(st)) {
          const spec = st[k]
          if (!isRecord(spec)) continue
          const color = pickString(spec.color)
          if (!color) continue
          const edgeWidthPx = typeof spec.edgeWidthPx === 'number' && Number.isFinite(spec.edgeWidthPx) ? spec.edgeWidthPx : null
          next.set(String(k || ''), { color, edgeWidthPx })
        }
        overlayEdgeSocketStyleByTypeRef.current = next
        return next
      })()

      const domOverlayRootEntries = (() => {
        if (typeof document === 'undefined') return [] as Array<{ id: string; el: HTMLElement }>
        const entries: Array<{ id: string; el: HTMLElement }> = []
        const els = Array.from(document.querySelectorAll<HTMLElement>(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR))
        for (let i = 0; i < els.length; i += 1) {
          const el = els[i]
          if (readFlowEditorOverlaySurfaceId(el) !== args.flowEditorSurfaceId) continue
          const id = readCanvasOverlayNodeId(el)
          if (!id) continue
          entries.push({ id, el })
        }
        return entries
      })()

      const overlayIdSet = (() => {
        const liveIds = Array.isArray(args.overlayEditorNodeIdsRef.current) && args.overlayEditorNodeIdsRef.current.length > 0
          ? args.overlayEditorNodeIdsRef.current
          : (Array.isArray(args.openWidgetNodeIdsRef.current) ? args.openWidgetNodeIdsRef.current : [])
        const sel = String(args.pendingOverlayNodeIdRef.current || '').trim()
        const set = new Set<string>()
        for (let i = 0; i < liveIds.length; i += 1) {
          const id = String(liveIds[i] || '').trim()
          if (id) set.add(id)
        }
        for (let i = 0; i < domOverlayRootEntries.length; i += 1) {
          const id = String(domOverlayRootEntries[i]?.id || '').trim()
          if (id) set.add(id)
        }
        if (sel) set.add(sel)
        if (set.size > 0) {
          lastStableOverlayEdgeNodeIdsRef.current = Array.from(set)
          return set
        }
        for (let i = 0; i < lastStableOverlayEdgeNodeIdsRef.current.length; i += 1) {
          const id = String(lastStableOverlayEdgeNodeIdsRef.current[i] || '').trim()
          if (id) set.add(id)
        }
        return set
      })()
      if (overlayIdSet.size === 0) {
        removeAllPaths(overlayEdgePathByIdRef)
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        return
      }

      const nodeIds = new Set<string>()
      const nodes: Array<{ id: unknown; type?: unknown; properties?: unknown }> = []
      for (let i = 0; i < rawNodes.length; i += 1) {
        const id = String(rawNodes[i]?.id || '').trim()
        if (!id || !overlayIdSet.has(id)) continue
        nodeIds.add(id)
        nodes.push({ id, type: rawNodes[i]?.type, properties: rawNodes[i]?.properties })
      }

      const defaultPortKeyByNodeId = (() => {
        const map = new Map<string, { in: string; out: string }>()
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i]
          const id = String(node?.id || '').trim()
          if (!id) continue
          const outPortKey = pickDefaultFlowPortKey({ properties: node?.properties as never }, 'out') || FLOW_HANDLE_DEFAULT_EDGE_ID
          const inPortKey = pickDefaultFlowPortKey({ properties: node?.properties as never }, 'in') || FLOW_HANDLE_DEFAULT_EDGE_ID
          map.set(id, { out: outPortKey, in: inPortKey })
        }
        return map
      })()

      const readPropString = (props: unknown, key: string): string => {
        if (!props || typeof props !== 'object' || Array.isArray(props)) return ''
        const raw = (props as Record<string, unknown>)[key]
        return typeof raw === 'string' ? raw.trim() : ''
      }
      const endpointNodeId = (raw: unknown): string => {
        if (!raw) return ''
        if (typeof raw === 'string') {
          const s = raw.trim()
          if (!s) return ''
          const dot = s.indexOf('.')
          return dot > 0 ? s.slice(0, dot).trim() : s
        }
        if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : ''
        if (typeof raw === 'object' && !Array.isArray(raw) && 'id' in (raw as Record<string, unknown>)) {
          const idRaw = (raw as Record<string, unknown>).id
          const id = typeof idRaw === 'string' ? idRaw.trim() : typeof idRaw === 'number' && Number.isFinite(idRaw) ? String(idRaw) : ''
          if (!id) return ''
          const dot = id.indexOf('.')
          return dot > 0 ? id.slice(0, dot).trim() : id
        }
        return ''
      }

      const edges: Array<{
        id: string
        source: string
        target: string
        sourcePortKey: string
        targetPortKey: string
        stroke: string
        strokeWidth: string
      }> = []
      for (let i = 0; i < rawEdges.length; i += 1) {
        const id = String(rawEdges[i]?.id || '').trim()
        const source = endpointNodeId(rawEdges[i]?.source)
        const target = endpointNodeId(rawEdges[i]?.target)
        if (!id || !source || !target) continue
        if (!overlayIdSet.has(source) || !overlayIdSet.has(target)) continue
        const props = rawEdges[i]?.properties
        const edgeWithProps = { properties: props as GraphEdge['properties'] } as Pick<GraphEdge, 'properties'>
        const sourcePortKey =
          readFlowEdgePortKey(edgeWithProps, 'source')
          || defaultPortKeyByNodeId.get(source)?.out
          || FLOW_HANDLE_DEFAULT_EDGE_ID
        const targetPortKey =
          readFlowEdgePortKey(edgeWithProps, 'target')
          || defaultPortKeyByNodeId.get(target)?.in
          || FLOW_HANDLE_DEFAULT_EDGE_ID
        const edgeTypeFromEdge = pickString(rawEdges[i]?.type)
        const edgeTypeFromProps = readPropString(props, 'flow:socketType')
        const edgeSocketType = edgeTypeFromEdge || edgeTypeFromProps
        const style = edgeSocketType ? socketStyleByType.get(edgeSocketType) || null : null
        const stroke = style?.color || 'currentColor'
        const strokeWidth = style?.edgeWidthPx != null ? String(style.edgeWidthPx) : '1.5'
        edges.push({ id, source, target, sourcePortKey, targetPortKey, stroke, strokeWidth })
      }

      if (nodeIds.size === 0 || edges.length === 0) {
        removeAllPaths(overlayEdgePathByIdRef)
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        return
      }

      const overlayRectsByNodeId = (() => {
        const map = new Map<string, DOMRect>()
        const elById = new Map<string, HTMLElement>()
        for (let i = 0; i < domOverlayRootEntries.length; i += 1) {
          const entry = domOverlayRootEntries[i]
          const el = entry?.el
          const id = entry?.id
          if (!id || !nodeIds.has(id)) continue
          map.set(id, el.getBoundingClientRect())
          elById.set(id, el)
        }
        overlayElByNodeIdRef.current = elById
        return map
      })()
      if (overlayRectsByNodeId.size === 0) return

      const topPctByNodeAndHandle = (() => {
        const overlayNodeIds = nodes.map(n => String(n.id || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
        const overlayEdgeKeyParts: string[] = []
        for (let i = 0; i < edges.length; i += 1) {
          const e = edges[i]
          const sourceId = readEdgeEndpointId(e.source)
          const targetId = readEdgeEndpointId(e.target)
          overlayEdgeKeyParts.push(`${e.id}:${sourceId}->${targetId}:${e.sourcePortKey}|${e.targetPortKey}`)
        }
        overlayEdgeKeyParts.sort((a, b) => a.localeCompare(b))
        const reg = Array.isArray(args.widgetRegistryRef.current) ? (args.widgetRegistryRef.current as ReadonlyArray<WidgetRegistryEntry>) : null
        const cacheKey = `${overlayNodeIds.join(',')}|${overlayEdgeKeyParts.join(',')}`
        const cached = overlayEdgeTopPctCacheRef.current
        if (cached && cached.key === cacheKey && cached.registry === reg) return cached.map

        const handlesByNodeId = computeFlowHandlesByNode({
          nodes,
          edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            properties: { [FLOW_EDGE_SOURCE_PORT_KEY]: e.sourcePortKey, [FLOW_EDGE_TARGET_PORT_KEY]: e.targetPortKey },
          })),
          widgetRegistry: reg,
        })
        const map = new Map<string, Map<string, number>>()
        for (const [id, handles] of Object.entries(handlesByNodeId)) {
          const hm = new Map<string, number>()
          for (let i = 0; i < (handles.in || []).length; i += 1) hm.set(handles.in[i].id, handles.in[i].topPct)
          for (let i = 0; i < (handles.out || []).length; i += 1) hm.set(handles.out[i].id, handles.out[i].topPct)
          map.set(id, hm)
        }
        overlayEdgeTopPctCacheRef.current = { key: cacheKey, registry: reg, map }
        return map
      })()

      const rootRect = root.getBoundingClientRect()
      const baseLeft = Number.isFinite(rootRect.left) ? rootRect.left : null
      const baseTop = Number.isFinite(rootRect.top) ? rootRect.top : null
      if (baseLeft == null || baseTop == null) return
      const round2 = (value: number): number => Math.round(value * 100) / 100
      const globalEdgeType = readGlobalEdgeType(schema)
      const globalEdgeColor = readGlobalEdgeColor(schema)
      const edgeAnimated = readGlobalEdgeAnimationEnabled(schema)
      const globalEdgeThickness = readGlobalEdgeThicknessPx(schema)
      if (edgeAnimated) ensureEdgeAnimationStyleElement(typeof document !== 'undefined' ? document : null)

      const layoutSig = (() => {
        const nodeIdsSorted = Array.from(overlayRectsByNodeId.keys()).sort((a, b) => a.localeCompare(b))
        const nodeParts: string[] = []
        for (let i = 0; i < nodeIdsSorted.length; i += 1) {
          const nodeId = nodeIdsSorted[i]
          const rect = overlayRectsByNodeId.get(nodeId)
          if (!rect) continue
          const overlayEl = overlayElByNodeIdRef.current.get(nodeId) || null
          const scrollTop = overlayEl && Number.isFinite(overlayEl.scrollTop) ? round2(overlayEl.scrollTop) : 0
          const scrollLeft = overlayEl && Number.isFinite(overlayEl.scrollLeft) ? round2(overlayEl.scrollLeft) : 0
          nodeParts.push(`${nodeId}:${round2(rect.left)}:${round2(rect.top)}:${round2(rect.width)}:${round2(rect.height)}:${scrollLeft}:${scrollTop}`)
        }
        const edgeParts = edges
          .map(e => {
            const stroke = getEdgeBaseStroke(e as unknown as GraphEdge, schema)
            const strokeWidth = getEdgeStrokeWidth(e as unknown as GraphEdge, schema)
            const sourceId = readEdgeEndpointId(e.source)
            const targetId = readEdgeEndpointId(e.target)
            return `${e.id}:${sourceId}->${targetId}:${e.sourcePortKey}|${e.targetPortKey}:${stroke}:${strokeWidth}`
          })
          .sort((a, b) => a.localeCompare(b))
        const pending = pendingEdgePreviewRef.current
        const cursor = pendingEdgeCursorRef.current
        const pendingSig =
          pending.toolMode === 'addEdge' && pending.sourceId && cursor
            ? `${pending.toolMode}:${pending.sourceId}:${String(pending.sourcePortKey || '')}:${round2(cursor.x)}:${round2(cursor.y)}`
            : ''
        return `${round2(rootRect.left)}:${round2(rootRect.top)}:${round2(rootRect.width)}:${round2(rootRect.height)}|${nodeParts.join(',')}|${edgeParts.join(',')}|${pendingSig}`
      })()
      if (overlayEdgeLayoutSigRef.current === layoutSig) return
      overlayEdgeLayoutSigRef.current = layoutSig
      const keep = new Set<string>()

      const overlayElByNodeId = overlayElByNodeIdRef.current
      const esc = (s: string) => {
        const v = String(s || '')
        const c = (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS
        if (c?.escape) return c.escape(v)
        return v.replace(/[^a-zA-Z0-9_\-]/g, ch => `\\${ch}`)
      }
      const readAnchor = (anchorArgs: {
        nodeId: string
        dir: 'in' | 'out'
        portKey: string
        fallbackRect: DOMRect
        fallbackPct: number
      }): { x: number; y: number } | null => {
        const el = overlayElByNodeId.get(anchorArgs.nodeId)
        const portKey = String(anchorArgs.portKey || '').trim()
        const anchorCacheKey = `${anchorArgs.nodeId}|${anchorArgs.dir}|${portKey}`
        if (el && portKey) {
          const baseSel = `[data-kg-port-handle="1"][data-kg-port-dir="${anchorArgs.dir}"][data-kg-port-key="${esc(portKey)}"]`
          const dotBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="dot"]`) as HTMLElement | null
          const railBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="rail"]`) as HTMLElement | null
          const fallbackBtn = el.querySelector(`button${baseSel}`) as HTMLElement | null
          const resolveFromButton = (btn: HTMLElement | null): { x: number; y: number } | null => {
            if (!btn) return null
            const dotEl = btn.querySelector('span') as HTMLElement | null
            const r = dotEl ? dotEl.getBoundingClientRect() : btn.getBoundingClientRect()
            const x = Number.isFinite(r.left) && Number.isFinite(r.width)
              ? r.left + r.width / 2
              : anchorArgs.dir === 'out'
                ? r.right
                : r.left
            const y = r.top + r.height / 2
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null
            return { x, y }
          }
          const panelRect = el.getBoundingClientRect()
          const dotAnchor = resolveFromButton(dotBtn)
          const dotVisible = !!(dotAnchor && Number.isFinite(panelRect.top) && Number.isFinite(panelRect.bottom) && dotAnchor.y >= panelRect.top && dotAnchor.y <= panelRect.bottom)
          const railAnchor = resolveFromButton(railBtn)
          const fallbackAnchor = resolveFromButton(fallbackBtn)
          const nextAnchor = (dotVisible ? dotAnchor : null) || railAnchor || dotAnchor || fallbackAnchor
          if (nextAnchor) {
            const clampedY = Number.isFinite(anchorArgs.fallbackRect.top) && Number.isFinite(anchorArgs.fallbackRect.height) && anchorArgs.fallbackRect.height > 0
              ? Math.max(anchorArgs.fallbackRect.top, Math.min(anchorArgs.fallbackRect.top + anchorArgs.fallbackRect.height, nextAnchor.y))
              : nextAnchor.y
            const resolved = { x: nextAnchor.x, y: clampedY }
            if (Number.isFinite(resolved.x) && Number.isFinite(resolved.y)) {
              overlayEdgeAnchorCacheRef.current.set(anchorCacheKey, resolved)
              return resolved
            }
          }
        }
        const cached = overlayEdgeAnchorCacheRef.current.get(anchorCacheKey)
        if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) return cached
        const rect = anchorArgs.fallbackRect
        if (!(Number.isFinite(rect.top) && Number.isFinite(rect.left) && Number.isFinite(rect.right) && Number.isFinite(rect.height) && rect.height > 0)) return null
        const pct = Math.max(0, Math.min(100, anchorArgs.fallbackPct)) / 100
        return { x: anchorArgs.dir === 'out' ? rect.right : rect.left, y: rect.top + pct * rect.height }
      }

      const pending = pendingEdgePreviewRef.current
      const cursor = pendingEdgeCursorRef.current
      const wantsPending = pending.toolMode === 'addEdge' && !!pending.sourceId && !!cursor && Date.now() - cursor.ts < 4000
      if (!wantsPending) {
        if (overlayPendingEdgePathRef.current) {
          try {
            overlayPendingEdgePathRef.current.remove()
          } catch {
            void 0
          }
          overlayPendingEdgePathRef.current = null
        }
      } else {
        const sourceId = String(pending.sourceId || '').trim()
        const sRect = sourceId ? overlayRectsByNodeId.get(sourceId) : null
        if (sRect && cursor) {
          const handleKey = String(
            pending.sourcePortKey
            || defaultPortKeyByNodeId.get(sourceId)?.out
            || FLOW_HANDLE_DEFAULT_EDGE_ID,
          ).trim()
          const outHandleId = buildFlowHandleId({ dir: 'out', edgeId: handleKey })
          const sPct = topPctByNodeAndHandle.get(sourceId)?.get(outHandleId) ?? 50
          const a = readAnchor({ nodeId: sourceId, dir: 'out', portKey: handleKey, fallbackRect: sRect, fallbackPct: sPct })
          const sx = a ? a.x - baseLeft : sRect.right - baseLeft
          const sy = a ? a.y - baseTop : sRect.top - baseTop + (Math.max(0, Math.min(100, sPct)) / 100) * sRect.height
          const tx = cursor.x
          const ty = cursor.y
          if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(tx) && Number.isFinite(ty)) {
            const d = buildEdgePathD({ edgeType: globalEdgeType, sx, sy, tx, ty, rankdir })
            const existing = overlayPendingEdgePathRef.current
            const pathEl = existing || document.createElementNS('http://www.w3.org/2000/svg', 'path')
            if (!existing) {
              pathEl.setAttribute('fill', 'none')
              pathEl.setAttribute('stroke', globalEdgeColor)
              pathEl.setAttribute('stroke-width', String(globalEdgeThickness))
              pathEl.setAttribute('stroke-linejoin', 'round')
              pathEl.setAttribute('stroke-linecap', 'round')
              pathEl.setAttribute('stroke-dasharray', edgeAnimated ? '7 5' : '4 4')
              pathEl.style.animation = edgeAnimated ? 'kg-edge-dash-flow 1.25s linear infinite' : ''
              pathEl.setAttribute('opacity', '0.75')
              pathEl.setAttribute('pointer-events', 'none')
              svg.appendChild(pathEl)
              overlayPendingEdgePathRef.current = pathEl
            }
            const pendingDash = edgeAnimated ? '7 5' : '4 4'
            if (pathEl.getAttribute('stroke') !== globalEdgeColor) pathEl.setAttribute('stroke', globalEdgeColor)
            if (pathEl.getAttribute('stroke-width') !== String(globalEdgeThickness)) pathEl.setAttribute('stroke-width', String(globalEdgeThickness))
            if (pathEl.getAttribute('stroke-dasharray') !== pendingDash) pathEl.setAttribute('stroke-dasharray', pendingDash)
            pathEl.style.animation = edgeAnimated ? 'kg-edge-dash-flow 1.25s linear infinite' : ''
            if (pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d)
          }
        }
      }

      for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i]
        const edgeId = String(e?.id || '').trim()
        const source = readEdgeEndpointId(e?.source)
        const target = readEdgeEndpointId(e?.target)
        if (!edgeId || !source || !target) continue
        const sRect = overlayRectsByNodeId.get(source)
        const tRect = overlayRectsByNodeId.get(target)
        if (!sRect || !tRect || !(sRect.height > 0 && tRect.height > 0)) continue
        const outHandleId = buildFlowHandleId({ dir: 'out', edgeId: e.sourcePortKey || FLOW_HANDLE_DEFAULT_EDGE_ID })
        const inHandleId = buildFlowHandleId({ dir: 'in', edgeId: e.targetPortKey || FLOW_HANDLE_DEFAULT_EDGE_ID })
        const sPct = topPctByNodeAndHandle.get(source)?.get(outHandleId) ?? 50
        const tPct = topPctByNodeAndHandle.get(target)?.get(inHandleId) ?? 50
        const sAnchor = readAnchor({
          nodeId: source,
          dir: 'out',
          portKey: e.sourcePortKey || FLOW_HANDLE_DEFAULT_EDGE_ID,
          fallbackRect: sRect,
          fallbackPct: sPct,
        })
        const tAnchor = readAnchor({
          nodeId: target,
          dir: 'in',
          portKey: e.targetPortKey || FLOW_HANDLE_DEFAULT_EDGE_ID,
          fallbackRect: tRect,
          fallbackPct: tPct,
        })
        const sx = (sAnchor ? sAnchor.x : sRect.right) - baseLeft
        const tx = (tAnchor ? tAnchor.x : tRect.left) - baseLeft
        const sy = (sAnchor ? sAnchor.y : sRect.top + (Math.max(0, Math.min(100, sPct)) / 100) * sRect.height) - baseTop
        const ty = (tAnchor ? tAnchor.y : tRect.top + (Math.max(0, Math.min(100, tPct)) / 100) * tRect.height) - baseTop
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) continue

        const d = buildEdgePathD({
          edgeType: globalEdgeType,
          sx,
          sy,
          tx,
          ty,
          rankdir,
          curve: readEdgePathCurveOptions(e as unknown as GraphEdge, schema),
        })
        keep.add(edgeId)
        const existing = overlayEdgePathByIdRef.current.get(edgeId) || null
        const pathEl = existing || document.createElementNS('http://www.w3.org/2000/svg', 'path')
        const stroke = getEdgeBaseStroke(e as unknown as GraphEdge, schema)
        const strokeWidth = String(getEdgeStrokeWidth(e as unknown as GraphEdge, schema))
        if (!existing) {
          pathEl.setAttribute('fill', 'none')
          pathEl.setAttribute('stroke', stroke)
          pathEl.setAttribute('stroke-width', strokeWidth)
          pathEl.setAttribute('stroke-linejoin', 'round')
          pathEl.setAttribute('stroke-linecap', 'round')
          pathEl.setAttribute('stroke-dasharray', edgeAnimated ? '7 5' : '')
          pathEl.style.animation = edgeAnimated ? 'kg-edge-dash-flow 1.25s linear infinite' : ''
          svg.appendChild(pathEl)
          overlayEdgePathByIdRef.current.set(edgeId, pathEl)
        }
        if (pathEl.getAttribute('stroke') !== stroke) pathEl.setAttribute('stroke', stroke)
        if (pathEl.getAttribute('stroke-width') !== strokeWidth) pathEl.setAttribute('stroke-width', strokeWidth)
        const edgeDash = edgeAnimated ? '7 5' : ''
        if (pathEl.getAttribute('stroke-dasharray') !== edgeDash) pathEl.setAttribute('stroke-dasharray', edgeDash)
        pathEl.style.animation = edgeAnimated ? 'kg-edge-dash-flow 1.25s linear infinite' : ''
        if (pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d)
      }

      for (const [id, el] of overlayEdgePathByIdRef.current.entries()) {
        if (keep.has(id)) continue
        try {
          el.remove()
        } catch {
          void 0
        }
        overlayEdgePathByIdRef.current.delete(id)
      }
      if (keep.size === 0) overlayEdgeLayoutSigRef.current = ''
    })
  }, [args.active, args.draftGraphDataRef, args.openWidgetNodeIdsRef, args.overlayEditorNodeIdsRef, args.overlayOnlyModeEnabled, args.pendingOverlayNodeIdRef, args.rootRef, args.widgetRegistryRef, rankdir, schema])

  React.useEffect(() => {
    if (!args.active) return
    if (!args.overlayOnlyModeEnabled) return
    const onMove = (e: MouseEvent) => {
      const root = args.rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const baseLeft = Number.isFinite(rect.left) ? rect.left : null
      const baseTop = Number.isFinite(rect.top) ? rect.top : null
      if (baseLeft == null || baseTop == null) return
      const cx = typeof e.clientX === 'number' && Number.isFinite(e.clientX) ? e.clientX : baseLeft
      const cy = typeof e.clientY === 'number' && Number.isFinite(e.clientY) ? e.clientY : baseTop
      pendingEdgeCursorRef.current = { x: cx - baseLeft, y: cy - baseTop, ts: Date.now() }
      scheduleOverlayEdgeUpdate()
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      try {
        window.removeEventListener('mousemove', onMove)
      } catch {
        void 0
      }
    }
  }, [args.active, args.overlayOnlyModeEnabled, args.rootRef, scheduleOverlayEdgeUpdate])

  React.useEffect(() => {
    if (!args.active) return
    if (!args.overlayOnlyModeEnabled) return
    scheduleOverlayEdgeUpdate()
    const onInteractionFrame = () => {
      overlayEdgeLayoutSigRef.current = ''
      overlayEdgeAnchorCacheRef.current.clear()
      scheduleOverlayEdgeUpdate()
    }
    window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)
    const onAny = () => {
      overlayEdgeLayoutSigRef.current = ''
      overlayEdgeAnchorCacheRef.current.clear()
      scheduleOverlayEdgeUpdate()
    }
    const root = args.rootRef.current
    window.addEventListener('resize', onAny)
    window.addEventListener('scroll', onAny, true)
    document.addEventListener('scroll', onAny, true)
    document.addEventListener('wheel', onAny, { capture: true, passive: true })
    root?.addEventListener('scroll', onAny, true)
    root?.addEventListener('wheel', onAny, { capture: true, passive: true })
    return () => {
      try {
        window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)
      } catch {
        void 0
      }
      window.removeEventListener('resize', onAny)
      window.removeEventListener('scroll', onAny, true)
      document.removeEventListener('scroll', onAny, true)
      document.removeEventListener('wheel', onAny, true)
      root?.removeEventListener('scroll', onAny, true)
      root?.removeEventListener('wheel', onAny, true)
      removeAllPaths(overlayEdgePathByIdRef)
      overlayEdgeLayoutSigRef.current = ''
      overlayEdgeAnchorCacheRef.current.clear()
      lastStableOverlayEdgeNodeIdsRef.current = []
      if (overlayPendingEdgePathRef.current) {
        try {
          overlayPendingEdgePathRef.current.remove()
        } catch {
          void 0
        }
        overlayPendingEdgePathRef.current = null
      }
      if (overlayEdgeRafRef.current != null) {
        try {
          cancelAnimationFrame(overlayEdgeRafRef.current)
        } catch {
          void 0
        }
        overlayEdgeRafRef.current = null
      }
    }
  }, [args.active, args.overlayOnlyModeEnabled, args.rootRef, scheduleOverlayEdgeUpdate])

  return { overlayEdgesSvgRef }
}
