import React from 'react'

import { FLOW_HANDLE_DEFAULT_EDGE_ID, buildFlowHandleId, computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { hashRecordSignature32, hashSignatureParts } from '@/lib/hash/signature'
import { type ToolMode, isRecord, pickString } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import {
  CANVAS_OVERLAY_PROXY_ROOT_SELECTOR,
  FLOW_EDITOR_INTERACTION_FRAME_EVENT,
  FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR,
  isTransientOffscreenRichMediaOverlayRoot,
  readCanvasOverlayNodeId,
  readFlowEditorOverlaySurfaceId,
  shouldReplaceFlowEditorOverlayRectCandidate,
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
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'

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
  overlayEdgesEnabledRef: React.MutableRefObject<boolean>
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
  const overlayEdgeTransientRetryRef = React.useRef<{ key: string; count: number } | null>(null)
  const overlayEdgeReadinessRetryRef = React.useRef<{ key: string; count: number } | null>(null)
  const lastStableOverlayEdgeNodeIdsRef = React.useRef<string[]>([])
  const workspaceOverlayOpenRef = React.useRef(false)
  const scheduleOverlayEdgeUpdateRef = React.useRef<() => void>(() => void 0)
  const overlayEdgeTopPctCacheRef = React.useRef<{
    key: string
    map: Map<string, Map<string, number>>
  } | null>(null)
  const pendingEdgePreviewRef = React.useRef<{ toolMode: ToolMode; sourceId: string | null; sourcePortKey: string | null }>({
    toolMode: 'select',
    sourceId: null,
    sourcePortKey: null,
  })
  const pendingEdgeCursorRef = React.useRef<null | { x: number; y: number; ts: number }>(null)

  const cancelOverlayEdgeUpdate = React.useCallback(() => {
    if (overlayEdgeRafRef.current != null) {
      try {
        cancelAnimationFrame(overlayEdgeRafRef.current)
      } catch {
        void 0
      }
      overlayEdgeRafRef.current = null
    }
    overlayEdgeLayoutSigRef.current = ''
    overlayEdgeAnchorCacheRef.current.clear()
    overlayEdgeTransientRetryRef.current = null
    overlayEdgeReadinessRetryRef.current = null
  }, [])

  React.useEffect(() => {
    pendingEdgePreviewRef.current = {
      toolMode: args.toolMode,
      sourceId: args.pendingEdgeSourceId ? String(args.pendingEdgeSourceId || '').trim() : null,
      sourcePortKey: args.pendingEdgeSourcePortKey ? String(args.pendingEdgeSourcePortKey || '').trim() : null,
    }
  }, [args.pendingEdgeSourceId, args.pendingEdgeSourcePortKey, args.toolMode])

  const scheduleTransientOverlayEdgeRetry = React.useCallback((parts: string[]): boolean => {
    const retryKey = hashSignatureParts(['transient-overlay-edges', ...parts.map(part => String(part || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))])
    const prevRetry = overlayEdgeTransientRetryRef.current
    const nextCount = prevRetry && prevRetry.key === retryKey ? prevRetry.count + 1 : 1
    overlayEdgeTransientRetryRef.current = { key: retryKey, count: nextCount }
    if (nextCount > 12) return false
    if (overlayEdgeRafRef.current == null) {
      overlayEdgeRafRef.current = requestAnimationFrame(() => {
        overlayEdgeRafRef.current = null
        overlayEdgeLayoutSigRef.current = ''
        scheduleOverlayEdgeUpdateRef.current()
      })
    }
    return true
  }, [])

  const scheduleOverlayEdgeReadinessRetry = React.useCallback((reason: string): boolean => {
    const retryKey = hashSignatureParts(['overlay-edge-readiness', reason])
    const prevRetry = overlayEdgeReadinessRetryRef.current
    const nextCount = prevRetry && prevRetry.key === retryKey ? prevRetry.count + 1 : 1
    overlayEdgeReadinessRetryRef.current = { key: retryKey, count: nextCount }
    if (nextCount > 12) return false
    if (overlayEdgeRafRef.current == null) {
      overlayEdgeRafRef.current = requestAnimationFrame(() => {
        overlayEdgeRafRef.current = null
        scheduleOverlayEdgeUpdateRef.current()
      })
    }
    return true
  }, [])

  const setOverlayEdgesSvgRef = React.useCallback((node: SVGSVGElement | null) => {
    overlayEdgesSvgRef.current = node
    if (!node) {
      args.overlayEdgesEnabledRef.current = false
      return
    }
    overlayEdgeReadinessRetryRef.current = null
    overlayEdgeLayoutSigRef.current = ''
    scheduleOverlayEdgeUpdateRef.current()
  }, [args.overlayEdgesEnabledRef])

  const scheduleOverlayEdgeUpdate = React.useCallback(() => {
    if (!args.active) return
    if (!args.overlayEdgesEnabledRef.current) return
    if (workspaceOverlayOpenRef.current) return
    if (overlayEdgeRafRef.current != null) return
    overlayEdgeRafRef.current = requestAnimationFrame(() => {
      overlayEdgeRafRef.current = null
      if (workspaceOverlayOpenRef.current) return
      const root = args.rootRef.current
      if (!root) {
        scheduleOverlayEdgeReadinessRetry('missing-root')
        return
      }
      const svg = overlayEdgesSvgRef.current
      if (!svg) {
        scheduleOverlayEdgeReadinessRetry('missing-svg')
        return
      }
      overlayEdgeReadinessRetryRef.current = null
      const graph = args.draftGraphDataRef.current
      if (!graph) {
        if (
          (overlayEdgePathByIdRef.current.size > 0 || lastStableOverlayEdgeNodeIdsRef.current.length > 0)
          && scheduleTransientOverlayEdgeRetry(['missing-graph-data', String(lastStableOverlayEdgeNodeIdsRef.current.length), String(overlayEdgePathByIdRef.current.size)])
        ) return
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
        const surfaceId = String(args.flowEditorSurfaceId || '').trim()
        const surfaceRoot = surfaceId
          ? document.querySelector<HTMLElement>(`[${FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR}="${CSS.escape(surfaceId)}"]`)
          : null
        const queryRoot: ParentNode = surfaceRoot || root
        const els = Array.from(queryRoot.querySelectorAll<HTMLElement>(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR))
        for (let i = 0; i < els.length; i += 1) {
          const el = els[i]
          if (readFlowEditorOverlaySurfaceId(el) !== surfaceId) continue
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
        if (
          (overlayEdgePathByIdRef.current.size > 0 || lastStableOverlayEdgeNodeIdsRef.current.length > 0)
          && scheduleTransientOverlayEdgeRetry(['empty-overlay-node-set', String(lastStableOverlayEdgeNodeIdsRef.current.length), String(overlayEdgePathByIdRef.current.size)])
        ) return
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
        const source = readEdgeEndpointId(rawEdges[i]?.source)
        const target = readEdgeEndpointId(rawEdges[i]?.target)
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
        const stroke = style?.color || getEdgeBaseStroke(rawEdges[i] as unknown as GraphEdge, schema)
        const strokeWidth = style?.edgeWidthPx != null ? String(style.edgeWidthPx) : String(getEdgeStrokeWidth(rawEdges[i] as unknown as GraphEdge, schema))
        edges.push({ id, source, target, sourcePortKey, targetPortKey, stroke, strokeWidth })
      }

      if (nodeIds.size === 0 || edges.length === 0) {
        if (
          overlayEdgePathByIdRef.current.size > 0
          && scheduleTransientOverlayEdgeRetry(['empty-filtered-edge-set', String(nodeIds.size), String(edges.length), String(overlayIdSet.size), String(rawEdges.length)])
        ) return
        removeAllPaths(overlayEdgePathByIdRef)
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        return
      }

      const transientOffscreenOverlayIds: string[] = []
      const overlayRectsByNodeId = (() => {
        const selectedById = new Map<string, { el: HTMLElement; rect: DOMRect }>()
        for (let i = 0; i < domOverlayRootEntries.length; i += 1) {
          const entry = domOverlayRootEntries[i]
          const el = entry?.el
          const id = entry?.id
          if (!id || !nodeIds.has(id)) continue
          const rect = el.getBoundingClientRect()
          if (isTransientOffscreenRichMediaOverlayRoot(el, rect)) {
            transientOffscreenOverlayIds.push(id)
            continue
          }
          const next = { el, rect }
          if (shouldReplaceFlowEditorOverlayRectCandidate(selectedById.get(id), next)) selectedById.set(id, next)
        }
        const map = new Map<string, DOMRect>()
        const elById = new Map<string, HTMLElement>()
        for (const [id, entry] of selectedById) {
          map.set(id, entry.rect)
          elById.set(id, entry.el)
        }
        overlayElByNodeIdRef.current = elById
        return map
      })()
      if (transientOffscreenOverlayIds.length > 0) {
        scheduleTransientOverlayEdgeRetry(['offscreen-rich-media-bootstrap', ...transientOffscreenOverlayIds])
      }
      if (overlayRectsByNodeId.size === 0) {
        if (overlayEdgeRafRef.current == null) {
          overlayEdgeRafRef.current = requestAnimationFrame(() => {
            overlayEdgeRafRef.current = null
            scheduleOverlayEdgeUpdate()
          })
        }
        return
      }

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
        const registryKeyParts: Array<string | number | boolean> = ['registry', Array.isArray(reg) ? reg.length : 0]
        if (Array.isArray(reg)) {
          for (let i = 0; i < reg.length; i += 1) {
            const entry = reg[i]
            registryKeyParts.push(
              String(entry?.nodeTypeId || ''),
              String(entry?.widgetTypeId || ''),
              String(entry?.formId || ''),
              entry?.isEnabled === true,
              hashRecordSignature32({ fields: entry?.fields || [], ports: entry?.ports || [], mappings: entry?.schemaMappings || [] }, { maxEntries: 3, maxDepth: 4 }),
            )
          }
        }
        const cacheKey = hashSignatureParts(['topPct', overlayNodeIds.join(','), overlayEdgeKeyParts.join(','), hashSignatureParts(registryKeyParts)])
        const cached = overlayEdgeTopPctCacheRef.current
        if (cached && cached.key === cacheKey) return cached.map

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
        overlayEdgeTopPctCacheRef.current = { key: cacheKey, map }
        return map
      })()

      const rootRect = root.getBoundingClientRect()
      const baseLeft = Number.isFinite(rootRect.left) ? rootRect.left : null
      const baseTop = Number.isFinite(rootRect.top) ? rootRect.top : null
      const svgWidth = Number.isFinite(rootRect.width) ? Math.max(1, Math.round(rootRect.width)) : 1
      const svgHeight = Number.isFinite(rootRect.height) ? Math.max(1, Math.round(rootRect.height)) : 1
      if (baseLeft == null || baseTop == null) return
      const svgViewBox = `0 0 ${svgWidth} ${svgHeight}`
      if (svg.getAttribute('width') !== String(svgWidth)) svg.setAttribute('width', String(svgWidth))
      if (svg.getAttribute('height') !== String(svgHeight)) svg.setAttribute('height', String(svgHeight))
      if (svg.getAttribute('viewBox') !== svgViewBox) svg.setAttribute('viewBox', svgViewBox)
      if (svg.getAttribute('preserveAspectRatio') !== 'none') svg.setAttribute('preserveAspectRatio', 'none')
      const round2 = (value: number): number => Math.round(value * 100) / 100
      const buildRectAnchorCacheKey = (nodeId: string, dir: 'in' | 'out', portKey: string, rect: DOMRect): string => [
        nodeId,
        dir,
        portKey,
        round2(rect.left),
        round2(rect.top),
        round2(rect.width),
        round2(rect.height),
      ].join('|')
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
            const sourceId = readEdgeEndpointId(e.source)
            const targetId = readEdgeEndpointId(e.target)
            return `${e.id}:${sourceId}->${targetId}:${e.sourcePortKey}|${e.targetPortKey}:${e.stroke}:${e.strokeWidth}`
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
        const rect = anchorArgs.fallbackRect
        const anchorCacheKey = buildRectAnchorCacheKey(anchorArgs.nodeId, anchorArgs.dir, portKey, rect)
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
        if (!(Number.isFinite(rect.top) && Number.isFinite(rect.left) && Number.isFinite(rect.right) && Number.isFinite(rect.height) && rect.height > 0)) return null
        const pct = Math.max(0, Math.min(100, anchorArgs.fallbackPct)) / 100
        return { x: anchorArgs.dir === 'out' ? rect.right : rect.left, y: rect.top + pct * rect.height }
      }

      const transientMissingEdgeAnchorParts: string[] = []
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
        const existing = overlayEdgePathByIdRef.current.get(edgeId) || null
        if (!sRect || !tRect || !(sRect.height > 0 && tRect.height > 0)) {
          transientMissingEdgeAnchorParts.push(`${edgeId}:${source}:${target}`)
          if (existing) keep.add(edgeId)
          continue
        }
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
        const pathEl = existing || document.createElementNS('http://www.w3.org/2000/svg', 'path')
        const stroke = e.stroke
        const strokeWidth = e.strokeWidth
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
      if (transientMissingEdgeAnchorParts.length > 0) {
        const retryKey = hashSignatureParts(['missing-edge-anchors', ...transientMissingEdgeAnchorParts.sort((a, b) => a.localeCompare(b))])
        const prevRetry = overlayEdgeTransientRetryRef.current
        const nextCount = prevRetry && prevRetry.key === retryKey ? prevRetry.count + 1 : 1
        overlayEdgeTransientRetryRef.current = { key: retryKey, count: nextCount }
        if (nextCount <= 8 && overlayEdgeRafRef.current == null) {
          overlayEdgeRafRef.current = requestAnimationFrame(() => {
            overlayEdgeRafRef.current = null
            overlayEdgeLayoutSigRef.current = ''
            scheduleOverlayEdgeUpdate()
          })
        }
      } else {
        overlayEdgeTransientRetryRef.current = null
      }
      if (keep.size === 0) overlayEdgeLayoutSigRef.current = ''
    })
  }, [args.active, args.draftGraphDataRef, args.flowEditorSurfaceId, args.openWidgetNodeIdsRef, args.overlayEdgesEnabledRef, args.overlayEditorNodeIdsRef, args.pendingOverlayNodeIdRef, args.rootRef, args.widgetRegistryRef, rankdir, scheduleOverlayEdgeReadinessRetry, scheduleTransientOverlayEdgeRetry, schema])
  scheduleOverlayEdgeUpdateRef.current = scheduleOverlayEdgeUpdate

  React.useEffect(() => {
    const readWorkspaceOverlayOpen = () => isWorkspaceEditorOverlayOpen(useGraphStore.getState())
    workspaceOverlayOpenRef.current = readWorkspaceOverlayOpen()
    if (workspaceOverlayOpenRef.current) cancelOverlayEdgeUpdate()
    const unsub = useGraphStore.subscribe(
      s => [s.workspaceViewMode, s.workspaceCanvasPaneOpen] as const,
      () => {
        const wasOpen = workspaceOverlayOpenRef.current
        const isOpen = readWorkspaceOverlayOpen()
        workspaceOverlayOpenRef.current = isOpen
        if (isOpen) {
          cancelOverlayEdgeUpdate()
          return
        }
        if (wasOpen) scheduleOverlayEdgeUpdate()
      },
    )
    return () => unsub()
  }, [cancelOverlayEdgeUpdate, scheduleOverlayEdgeUpdate])

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
    const overlayEdgeAnchorCache = overlayEdgeAnchorCacheRef.current
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
      overlayEdgeAnchorCache.clear()
      lastStableOverlayEdgeNodeIdsRef.current = []
      if (overlayPendingEdgePathRef.current) {
        try {
          overlayPendingEdgePathRef.current.remove()
        } catch {
          void 0
        }
        overlayPendingEdgePathRef.current = null
      }
      cancelOverlayEdgeUpdate()
    }
  }, [args.active, args.overlayOnlyModeEnabled, args.rootRef, cancelOverlayEdgeUpdate, scheduleOverlayEdgeUpdate])

  return { overlayEdgesSvgRef: setOverlayEdgesSvgRef, scheduleOverlayEdgeUpdate }
}
