import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { fitFlowEditorPinnedWidgets } from '@/components/FlowCanvas/fitPinnedWidgets'
import { buildFlowFitOptions, readFlowEditorPortExtraPadScreenPx } from '@/components/FlowCanvas/fitRuntime'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import type { ZoomRequest } from '@/lib/zoom/requests'
import type { GraphData } from '@/lib/graph/types'
import { setFlowNativeTransform, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import {
  collectCanonicalFlowEditorOverlayRectEntries,
  FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR,
  FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
  RICH_MEDIA_OVERLAY_ROOT_SELECTOR,
  readCanvasOverlayNodeId,
  readFlowEditorOverlaySurfaceId,
} from '@/lib/canvas/flow-editor-overlay-proxy'
import { easeOutCubic01, lerpNumber } from '@/lib/canvas/zoom-smoothing'
import { getFlowAutoMinScale, setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { DEFAULT_TOOLBAR_ZOOM_CONFIG } from '@/lib/zoom/toolbarZoom'
import { resolveZoomRequest2d } from '@/lib/zoom/resolveZoomRequest2d'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
const FLOW_ZOOM_MAX_VISUAL_CAP = 24

const escapeCssAttrValue = (value: string): string => {
  try {
    const cssApi = (globalThis as { CSS?: { escape?: (input: string) => string } }).CSS
    if (cssApi && typeof cssApi.escape === 'function') return cssApi.escape(value)
  } catch {
    void 0
  }
  return value.replace(/["\\\]]/g, '\\$&')
}

const FLOW_ZOOM_REQUEST_ANIMS = new WeakMap<FlowNativeRuntime, { rafId: number | null; token: number }>()
const WORKSPACE_LEFT_PANE_SELECTOR = '[data-kg-workspace-left-pane="1"]'

export function collectFlowEditorOverlayBounds(activeSurfaceId: string) {
  if (typeof document === 'undefined') return null
  const normalizedSurfaceId = String(activeSurfaceId || '').trim()
  const hasSurfaceId = normalizedSurfaceId.length > 0
  const surfaceRoot = hasSurfaceId
    ? document.querySelector<HTMLElement>(
      `[${FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR}="${escapeCssAttrValue(normalizedSurfaceId)}"]`,
    )
    : null
  const surfaceRect = surfaceRoot?.getBoundingClientRect() || null
  const surfaceOffsetLeft = Number.isFinite(surfaceRect?.left) ? Number(surfaceRect?.left) : 0
  const surfaceOffsetTop = Number.isFinite(surfaceRect?.top) ? Number(surfaceRect?.top) : 0
  const merged = new Map<string, { left: number; right: number; top: number; bottom: number; area: number }>()
  const pushEntries = (selector: string) => {
    const queryRoot: ParentNode = surfaceRoot || document
    const els = Array.from(queryRoot.querySelectorAll(selector))
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .filter(el => !hasSurfaceId || readFlowEditorOverlaySurfaceId(el) === normalizedSurfaceId)
    const entries = collectCanonicalFlowEditorOverlayRectEntries(els)
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]!
      const area = Math.max(0, entry.rect.width) * Math.max(0, entry.rect.height)
      const prev = merged.get(entry.id)
      if (prev && prev.area >= area) continue
      merged.set(entry.id, {
        left: entry.rect.left - surfaceOffsetLeft,
        right: entry.rect.right - surfaceOffsetLeft,
        top: entry.rect.top - surfaceOffsetTop,
        bottom: entry.rect.bottom - surfaceOffsetTop,
        area,
      })
    }
  }
  pushEntries(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR)
  pushEntries(RICH_MEDIA_OVERLAY_ROOT_SELECTOR)
  const entries = Array.from(merged.values()).filter(entry =>
    Number.isFinite(entry.left)
    && Number.isFinite(entry.right)
    && Number.isFinite(entry.top)
    && Number.isFinite(entry.bottom),
  )
  if (entries.length === 0) return null
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!
    minX = Math.min(minX, entry.left)
    maxX = Math.max(maxX, entry.right)
    minY = Math.min(minY, entry.top)
    maxY = Math.max(maxY, entry.bottom)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return null
  return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

export function resolveFlowEditorVisibleViewport(args: {
  flowEditorSurfaceId?: string
  viewportW: number
  viewportH: number
}) {
  const fallback = {
    left: 0,
    top: 0,
    right: args.viewportW,
    bottom: args.viewportH,
    width: args.viewportW,
    height: args.viewportH,
    centerX: args.viewportW / 2,
    centerY: args.viewportH / 2,
  }
  if (typeof document === 'undefined') return fallback
  const surfaceId = String(args.flowEditorSurfaceId || '').trim()
  if (!surfaceId) return fallback
  const surfaceRoot = document.querySelector<HTMLElement>(
    `[${FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR}="${escapeCssAttrValue(surfaceId)}"]`,
  )
  if (!(surfaceRoot instanceof HTMLElement)) return fallback
  const rect = surfaceRoot.getBoundingClientRect()
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !Number.isFinite(rect.right) || !Number.isFinite(rect.bottom)) return fallback
  const top = Math.max(0, Math.min(args.viewportH, rect.top))
  const bottom = Math.max(top + 1, Math.min(args.viewportH, rect.bottom))
  let left = Math.max(0, Math.min(args.viewportW, rect.left))
  const right = Math.max(left + 1, Math.min(args.viewportW, rect.right))
  const paneEls = Array.from(document.querySelectorAll(WORKSPACE_LEFT_PANE_SELECTOR))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
  let maxPaneRight = Number.NEGATIVE_INFINITY
  let maxPaneWidth = 0
  for (let i = 0; i < paneEls.length; i += 1) {
    const paneRect = paneEls[i]!.getBoundingClientRect()
    if (!Number.isFinite(paneRect.left) || !Number.isFinite(paneRect.right) || !Number.isFinite(paneRect.top) || !Number.isFinite(paneRect.bottom)) continue
    if (paneRect.right <= left || paneRect.left >= right) continue
    if (paneRect.bottom <= top || paneRect.top >= bottom) continue
    maxPaneRight = Math.max(maxPaneRight, Math.min(args.viewportW, Math.max(0, paneRect.right)))
    maxPaneWidth = Math.max(maxPaneWidth, Math.max(0, Math.min(args.viewportW, paneRect.right) - Math.max(0, paneRect.left)))
  }
  const visibleViewportWidth = Math.max(1, right - left)
  const paneCoverageRatio = maxPaneWidth / visibleViewportWidth
  const hasUsableRightCanvasStrip = right - maxPaneRight >= 160
  const shouldSubtractPaneOverlap =
    Number.isFinite(maxPaneRight)
    && paneCoverageRatio < 0.86
    && hasUsableRightCanvasStrip
  if (shouldSubtractPaneOverlap) {
    left = Math.max(left, maxPaneRight)
  }
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  }
}

function recenterVisibleFlowEditorOverlayCentroid(args: {
  runtime: FlowNativeRuntime
  viewportW: number
  viewportH: number
  flowEditorSurfaceId?: string
  onFrame?: () => void
}) {
  if (typeof document === 'undefined') return
  const activeSurfaceId = String(args.flowEditorSurfaceId || '').trim()
  const recenterOverlayWidgetPositions = (deltaX: number, deltaY: number) => {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return
    const st = useGraphStore.getState()
    const base = st.flowWidgetWorldPosByNodeId || {}
    const ids = new Set<string>()
    const selectors = [FLOW_EDITOR_OVERLAY_ROOT_SELECTOR, RICH_MEDIA_OVERLAY_ROOT_SELECTOR]
    for (let i = 0; i < selectors.length; i += 1) {
      const selector = selectors[i]!
      const roots = Array.from(document.querySelectorAll(selector)).filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement
          && readFlowEditorOverlaySurfaceId(el) === activeSurfaceId,
      )
      for (let j = 0; j < roots.length; j += 1) {
        const nodeId = readCanvasOverlayNodeId(roots[j])
        if (nodeId) ids.add(nodeId)
      }
    }
    if (ids.size === 0) return
    let changedWorld = false
    let changedScreen = false
    const nextWorld = { ...base }
    const nextScreen = { ...(st.flowWidgetPosByNodeId || {}) }
    ids.forEach((nodeId) => {
      const curWorld = nextWorld[nodeId]
      if (curWorld && Number.isFinite(curWorld.x) && Number.isFinite(curWorld.y)) {
        nextWorld[nodeId] = { x: curWorld.x + deltaX, y: curWorld.y + deltaY }
        changedWorld = true
      }
      const curScreen = nextScreen[nodeId]
      if (curScreen && Number.isFinite(curScreen.left) && Number.isFinite(curScreen.top)) {
        nextScreen[nodeId] = { left: curScreen.left + deltaX, top: curScreen.top + deltaY }
        changedScreen = true
      }
    })
    if (changedWorld) st.setFlowWidgetWorldPosByNodeId(nextWorld)
    if (changedScreen) st.setFlowWidgetPosByNodeId(nextScreen)
  }
  const run = () => {
    const bounds = collectFlowEditorOverlayBounds(activeSurfaceId)
    if (!bounds) return
    const visibleViewport = resolveFlowEditorVisibleViewport({
      flowEditorSurfaceId: activeSurfaceId,
      viewportW: args.viewportW,
      viewportH: args.viewportH,
    })
    const allEntries = [
      { left: bounds.minX, right: bounds.maxX, top: bounds.minY, bottom: bounds.maxY },
    ]
    const visibleEntries = allEntries.filter(
      entry =>
        entry.right > visibleViewport.left
        && entry.bottom > visibleViewport.top
        && entry.left < visibleViewport.right
        && entry.top < visibleViewport.bottom,
    )
    // If every overlay drifted outside viewport, fall back to the full collective
    // bounds so fit/reset can always recover and recenter the layout.
    const entries = visibleEntries.length > 0 ? visibleEntries : allEntries
    const centroid = entries.reduce((acc, entry) => ({
      x: acc.x + (entry.left + entry.right) / 2,
      y: acc.y + (entry.top + entry.bottom) / 2,
    }), { x: 0, y: 0 })
    centroid.x /= entries.length
    centroid.y /= entries.length
    const deltaX = visibleViewport.centerX - centroid.x
    const deltaY = visibleViewport.centerY - centroid.y
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return
    const current = args.runtime.transform || d3.zoomIdentity
    setFlowNativeTransform(args.runtime, d3.zoomIdentity.translate(current.x + deltaX, current.y + deltaY).scale(current.k))
    recenterOverlayWidgetPositions(deltaX, deltaY)
    args.onFrame?.()
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}

export const cancelFlowZoomRequestAnim = (runtime: FlowNativeRuntime) => {
  const prev = FLOW_ZOOM_REQUEST_ANIMS.get(runtime)
  if (!prev) return
  if (prev.rafId != null) {
    try {
      cancelAnimationFrame(prev.rafId)
    } catch {
      void 0
    }
  }
  FLOW_ZOOM_REQUEST_ANIMS.set(runtime, { rafId: null, token: prev.token + 1 })
}

export const applyZoomRequestNative = (args: {
  zoomRequest: ZoomRequest
  runtime: FlowNativeRuntime
  graphData: GraphData | null
  flowEditorSurfaceId?: string
  width: number
  height: number
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
  onFrame?: () => void
}) => {
  const clear = () => {
    try {
      useGraphStore.getState().clearZoomRequest()
    } catch {
      void 0
    }
  }
  const state = useGraphStore.getState()
  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen(state)
  const schema = state.schema
  if (!schema) {
    clear()
    return
  }
  const t0 = args.runtime.transform || d3.zoomIdentity
  const [schemaMinK, schemaMaxK] = readZoomScaleExtent(schema)
  const flowMinK = Math.min(schemaMinK, 0.000001)
  const flowMaxK = Math.min(schemaMaxK, FLOW_ZOOM_MAX_VISUAL_CAP)
  const autoMinK = getFlowAutoMinScale(args.runtime)
  const viewportW = Math.max(1, Math.floor(args.width))
  const viewportH = Math.max(1, Math.floor(args.height))
  const visibleViewport = resolveFlowEditorVisibleViewport({
    flowEditorSurfaceId: args.flowEditorSurfaceId,
    viewportW,
    viewportH,
  })
  const isFlowEditorFitLikeRequest =
    state.canvasRenderMode === '2d'
    && state.canvas2dRenderer === 'flowEditor'
    && (
      args.zoomRequest.type === 'reset'
      || args.zoomRequest.type === 'fit'
    )
  const forceImmediateWorkspaceOverlayFit = workspaceEditorOverlayOpen && isFlowEditorFitLikeRequest
  const isFlowEditorGraphFitRequest =
    isFlowEditorFitLikeRequest
    && !!args.graphData
    && Array.isArray(args.graphData.nodes)
    && args.graphData.nodes.length > 0
  const flowEditorOverlayFitResolved = isFlowEditorFitLikeRequest && !workspaceEditorOverlayOpen
    ? (() => {
        const bounds = collectFlowEditorOverlayBounds(String(args.flowEditorSurfaceId || ''))
        if (!bounds) return null
        const pad = 48
        const fitW = Math.max(1, visibleViewport.width - pad * 2)
        const fitH = Math.max(1, visibleViewport.height - pad * 2)
        const base = args.runtime.transform || d3.zoomIdentity
        const safeBaseK = Number.isFinite(base.k) && base.k > 0 ? base.k : 1
        const scaleBy = Math.min(fitW / bounds.width, fitH / bounds.height)
        const targetK = Math.max(flowMinK, Math.min(flowMaxK, safeBaseK * scaleBy))
        const appliedScale = targetK / safeBaseK
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2
        const targetX = visibleViewport.centerX - (centerX - base.x) * appliedScale
        const targetY = visibleViewport.centerY - (centerY - base.y) * appliedScale
        return {
          nextTransform: d3.zoomIdentity.translate(targetX, targetY).scale(targetK),
          durationMs: args.zoomRequest.type === 'reset' ? 250 : Math.max(0, Math.floor(state.zoomDurationFitMs || 300)),
          nextMinScale: targetK,
        }
      })()
    : null
  const resolved = flowEditorOverlayFitResolved
    ? flowEditorOverlayFitResolved
    : isFlowEditorGraphFitRequest
    ? (() => {
        const intent =
          args.zoomRequest.type === 'fit' && args.zoomRequest.intent === 'fitToScreen'
            ? 'fitToScreen'
            : 'fitToView'
        const fitOpts = buildFlowFitOptions({
          schema,
          intent,
          frontmatterModeEnabled: state.frontmatterModeEnabled === true,
          multiDimTableModeEnabled: state.multiDimTableModeEnabled === true,
          documentSemanticMode: String(state.documentSemanticMode || 'document'),
          documentStructureBaselineLock: state.documentStructureBaselineLock === true,
          enableDocumentStructureBounds: intent !== 'fitToScreen',
          frontmatterFlowInitialFitFillRatio: state.frontmatterFlowInitialFitFillRatio,
        })
        const useWorkspaceOverlayGraphFallbackFit = workspaceEditorOverlayOpen
        const fit = useWorkspaceOverlayGraphFallbackFit
          ? fitAllTransform(
              args.graphData?.nodes || [],
              Math.max(1, visibleViewport.width),
              Math.max(1, visibleViewport.height),
              { ...fitOpts, graphData: args.graphData || undefined },
            )
          : fitFlowEditorPinnedWidgets({
              nodes: args.graphData?.nodes || [],
              fitW: viewportW,
              viewportW,
              viewportH,
              openWidgetNodeIds: Array.isArray(state.openWidgetNodeIds) ? state.openWidgetNodeIds : [],
              pinnedById: state.flowWidgetPinnedByNodeId || {},
              worldPosById: state.flowWidgetWorldPosByNodeId || {},
              portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(schema),
              graphData: args.graphData,
              frontmatterOverlayFitProxyScales: {
                phone: state.frontmatterFlowOverlayFitProxyScalePhone,
                tablet: state.frontmatterFlowOverlayFitProxyScaleTablet,
                laptop: state.frontmatterFlowOverlayFitProxyScaleLaptop,
                desktop: state.frontmatterFlowOverlayFitProxyScaleDesktop,
              },
              fitOpts,
            })
        return {
          nextTransform: fit,
          durationMs: args.zoomRequest.type === 'reset' ? 250 : Math.max(0, Math.floor(state.zoomDurationFitMs || 300)),
          nextMinScale: fit.k,
        }
      })()
    : resolveZoomRequest2d({
        zoomRequest: args.zoomRequest,
        graphData: args.graphData,
        schema,
        documentSemanticMode: (state.documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
        graphDataRevision: state.graphDataRevision || 0,
        viewportW,
        viewportH,
        viewPinned: state.viewPinned === true,
        durations: { fitMs: state.zoomDurationFitMs, selectionMs: state.zoomDurationSelectionMs },
        toolbarZoom: DEFAULT_TOOLBAR_ZOOM_CONFIG,
        selectedNodeId: args.selectedNodeId,
        selectedEdgeId: args.selectedEdgeId,
        selectedGroupId: args.selectedGroupId,
        selectedNodeIds: args.selectedNodeIds,
        selectedEdgeIds: args.selectedEdgeIds,
        selectedGroupIds: args.selectedGroupIds,
        currentTransform: t0,
        schemaExtent: { minK: flowMinK, maxK: flowMaxK },
        currentExtent: { minK: autoMinK ?? flowMinK, maxK: flowMaxK },
        cacheKeyBase: '2d',
      })
  if (!resolved) {
    clear()
    return
  }
  const nextMinScale = resolved.nextMinScale
  if (typeof nextMinScale === 'number' && Number.isFinite(nextMinScale) && nextMinScale < flowMinK) {
    const prev = getFlowAutoMinScale(args.runtime)
    const combined = prev == null ? nextMinScale : Math.min(prev, nextMinScale)
    setFlowAutoMinScale(args.runtime, combined)
  }
  clear()
  const durationMs = forceImmediateWorkspaceOverlayFit
    ? 0
    : Math.max(0, Math.floor(resolved.durationMs))
  if (durationMs === 0) {
    cancelFlowZoomRequestAnim(args.runtime)
    setFlowNativeTransform(args.runtime, resolved.nextTransform)
    args.onFrame?.()
    if (isFlowEditorFitLikeRequest && !workspaceEditorOverlayOpen) {
      recenterVisibleFlowEditorOverlayCentroid({
        runtime: args.runtime,
        viewportW,
        viewportH,
        flowEditorSurfaceId: args.flowEditorSurfaceId,
        onFrame: args.onFrame,
      })
    }
    return
  }
  cancelFlowZoomRequestAnim(args.runtime)
  const prev = FLOW_ZOOM_REQUEST_ANIMS.get(args.runtime)
  const token = (prev?.token || 0) + 1
  FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId: null, token })
  const start = performance.now()
  const from = t0
  const to = resolved.nextTransform
  const tick = (now: number) => {
    const st = FLOW_ZOOM_REQUEST_ANIMS.get(args.runtime)
    if (!st || st.token !== token) return
    const raw01 = durationMs > 0 ? (now - start) / durationMs : 1
    const eased = easeOutCubic01(raw01)
    const k = lerpNumber(from.k, to.k, eased)
    const x = lerpNumber(from.x, to.x, eased)
    const y = lerpNumber(from.y, to.y, eased)
    setFlowNativeTransform(args.runtime, d3.zoomIdentity.translate(x, y).scale(k))
    args.onFrame?.()
    if (!(raw01 < 1)) {
      FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId: null, token })
      if (isFlowEditorFitLikeRequest && !workspaceEditorOverlayOpen) {
        recenterVisibleFlowEditorOverlayCentroid({
          runtime: args.runtime,
          viewportW,
          viewportH,
          flowEditorSurfaceId: args.flowEditorSurfaceId,
          onFrame: args.onFrame,
        })
      }
      return
    }
    const rafId = requestAnimationFrame(tick)
    FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId, token })
  }
  const rafId = requestAnimationFrame(tick)
  FLOW_ZOOM_REQUEST_ANIMS.set(args.runtime, { rafId, token })
  try {
    useGraphStore.getState().setLifecycleStage('zoomUpdate')
  } catch {
    void 0
  }
}
