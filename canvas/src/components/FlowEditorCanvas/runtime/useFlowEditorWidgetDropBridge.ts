import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import {
  FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
  readGrabMapsDiscoveryWidgetProperties,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
  getFlowTextGenerationSeedPrompt,
} from '@/lib/config'
import {
  clearActiveFlowWidgetPointerDragSession,
  hasFlowWidgetDragType,
  readActiveFlowWidgetPointerDragSession,
  readFlowWidgetDragPayloadFromDataTransfer,
} from '@/lib/flowEditor/widgetDrag'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import {
  getWidgetRegistryEntryLabel,
  inferTextGenerationProviderFamily,
  resolveEffectiveTextGenerationWidgetProperties,
  resolveTextGenerationGlobalDefaultsForProviderFamily,
} from '@/features/flow-editor-manager/registryTemplates'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { screenToWorld } from '@/lib/zoom/viewport'
import { requestGeospatialCurrentLocation, setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { readGeospatialCursorLngLat } from '@/lib/gympgrph/api'
import {
  OVERLAY_NODE_OVERRIDE_LOCK_MS,
  isRecord,
  pickFiniteNumber,
  readFiniteGeoLatLng,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { buildBytePlusImageWidgetSeedProperties } from '@/features/integrations/byteplusImageGenerationDefaults'
import { buildBytePlusVideoWidgetSeedProperties } from '@/features/integrations/byteplusVideoGenerationDefaults'
import { buildRichMediaPanelDroppedMediaProperties } from '@/lib/render/richMediaPanelNode'
import { RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE } from '@/lib/render/richMediaPanelDefaults'
import {
  MEDIA_POINTER_DRAG_DROP_EVENT,
  claimMediaPointerDragDrop,
  clearMediaPointerDragPayload,
  hasMediaDragPayload,
  isMediaPointerDragDropClaimed,
  isMediaDropClaimedByNestedTarget,
  readMediaDragPayload,
  type MediaDragPayload,
  type MediaPointerDragDropDetail,
} from '@/lib/ui/mediaDragPayload'

// #region debug-point A:widget-drop-bridge-media-panel
const STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event'
const STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SESSION_ID = 'storyboard-media-panel-loop'
const reportStoryboardMediaPanelLoopWidgetDropDebug = (args: {
  hypothesisId: 'A' | 'B' | 'C' | 'D' | 'E'
  location: string
  msg: string
  data?: Record<string, unknown>
}) => {
  if (typeof fetch !== 'function') return
  void fetch(STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SERVER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SESSION_ID,
      runId: 'pre-fix',
      hypothesisId: args.hypothesisId,
      location: args.location,
      msg: `[DEBUG] ${args.msg}`,
      data: args.data || {},
      ts: Date.now(),
    }),
  }).catch(() => {
    void 0
  })
}
// #endregion

function addFlowEditorUsedNodeIdVariants(out: Set<string>, rawId: unknown): void {
  const id = String(rawId || '').trim()
  if (!id) return
  out.add(id)
  const parts = id.split('::').map(part => part.trim()).filter(Boolean)
  const suffix = parts.length > 1 ? parts[parts.length - 1] : ''
  if (suffix) out.add(suffix)
}

function findRichMediaPanelNodeIdBySourceKey(graphData: GraphData | null | undefined, sourceKey: unknown): string {
  const key = String(sourceKey || '').trim()
  if (!key) return ''
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  for (const node of nodes) {
    if (String(node?.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) continue
    const properties = node.properties && typeof node.properties === 'object' ? node.properties as Record<string, unknown> : {}
    if (String(properties.mediaSourceKey || '').trim() === key) return String(node.id || '').trim()
  }
  return ''
}

export function useFlowEditorWidgetDropBridge(args: {
  active: boolean
  widgetDropCaptureEnabled?: boolean
  widgetDropBridgeOnly: boolean
  geospatialWidgetPanelMode?: boolean
  rootRef: React.RefObject<HTMLElement | null>
  widgetRegistryRef: React.MutableRefObject<ReadonlyArray<WidgetRegistryEntry>>
  baseGraphData: GraphData | null
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  reservedNodeIdsRef: React.MutableRefObject<Set<string>>
  pendingOverlayNodeIdRef: React.MutableRefObject<string | null>
  pendingOpenWidgetNodeIdRef: React.MutableRefObject<string | null>
  overlayNodeIdOverrideWasSelectedRef: React.MutableRefObject<boolean>
  overlayNodeIdOverrideUntilMsRef: React.MutableRefObject<number>
  lastDroppedWidgetNodeIdRef: React.MutableRefObject<string | null>
  zoomViewKeyRef: React.MutableRefObject<string | null>
  getLiveZoomTransform: () => { k: number; x: number; y: number } | null
  appendDraftNode: (args: {
    id?: string | null
    type: string
    label?: string | null
    x: number
    y: number
    fx?: number | null
    fy?: number | null
    vx?: number | null
    vy?: number | null
    properties?: Record<string, unknown>
  }) => string
  updateNode: (nodeId: string, patch: Partial<GraphNode>) => void
  shouldDedupeWidgetDrop: (key: string) => boolean
  scheduleForceSelect: (id: string, opts?: { minHoldMs?: number }) => void
  setCanvasWindowOffsetFromRect: (rect: DOMRect) => void
  setOverlayNodeIdOverride: React.Dispatch<React.SetStateAction<string | null>>
  setPendingOverlayNode: React.Dispatch<React.SetStateAction<GraphNode | null>>
  setLastDroppedWidgetToken: React.Dispatch<React.SetStateAction<number>>
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
}) {
  const openPendingOverlayNode = React.useCallback((rawId: unknown) => {
    const id = String(rawId || '').trim()
    if (!id) return
    useGraphStore.getState().updateOpenWidgetNodeIds(prev => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const syncGrabMapsDiscoveryGeoFromDropCursor = React.useCallback(
    (payload: { id: string; properties: Record<string, unknown> }) => {
      if (!args.widgetDropBridgeOnly) return
      if (typeof window === 'undefined') return
      let cancelled = false
      let attempts = 0
      const trySync = () => {
        if (cancelled) return
        attempts += 1
        const cursor = readGeospatialCursorLngLat()
        const lat = cursor ? Number(cursor.lat) : Number.NaN
        const lng = cursor ? Number(cursor.lng) : Number.NaN
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const baseGeo = isRecord(payload.properties.geo) ? payload.properties.geo : {}
          const nextProperties = {
            ...payload.properties,
            geo: {
              ...baseGeo,
              lat,
              lng,
            },
          }
          args.updateNode(payload.id, { properties: nextProperties as never })
          args.setPendingOverlayNode(prev => {
            if (!prev || String(prev.id || '') !== payload.id) return prev
            const prevProps = isRecord(prev.properties) ? prev.properties : {}
            const prevGeo = isRecord(prevProps.geo) ? prevProps.geo : {}
            return {
              ...prev,
              properties: {
                ...prevProps,
                geo: {
                  ...prevGeo,
                  lat,
                  lng,
                },
              } as never,
            }
          })
          void requestGeospatialCurrentLocation({ lat, lng }).catch(() => void 0)
          return
        }
        if (attempts >= 4) return
        window.setTimeout(() => {
          window.requestAnimationFrame(trySync)
        }, attempts === 1 ? 0 : 32)
      }
      window.requestAnimationFrame(trySync)
      window.setTimeout(() => {
        cancelled = true
      }, 240)
    },
    [args],
  )

  const addNodeFromRegistryAtWorld = React.useCallback(
    (payload: { entry: WidgetRegistryEntry; x: number; y: number }) => {
      const entry = payload.entry
      const x = Number.isFinite(payload.x) ? payload.x : 0
      const y = Number.isFinite(payload.y) ? payload.y : 0
      const label = getWidgetRegistryEntryLabel({
        nodeTypeId: entry.nodeTypeId,
        widgetTypeId: entry.widgetTypeId,
        formId: entry.formId,
      })
      const properties: Record<string, unknown> = {
        [FLOW_WIDGET_TYPE_ID_KEY]: entry.widgetTypeId,
        [FLOW_WIDGET_FORM_ID_KEY]: entry.formId,
      }
      if (entry.nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
        Object.assign(properties, buildBytePlusImageWidgetSeedProperties({
          prompt: 'Generate an image responsive to the active request.',
        }))
        properties.imageUrl = ''
      }
      if (entry.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
        const store = useGraphStore.getState()
        const providerFamily = inferTextGenerationProviderFamily({
          provider: store.chatProvider,
          widgetTypeId: entry.widgetTypeId,
          formId: entry.formId,
        })
        const nextTextProperties = resolveTextGenerationGlobalDefaultsForProviderFamily({
          providerFamily,
          globalProperties: {
            chatProvider: store.chatProvider,
            chatAuthMode: store.chatAuthMode,
            chatEndpointUrl: store.chatEndpointUrl,
            chatModel: store.chatModel,
            chatTemperature: store.chatTemperature,
            chatMaxCompletionTokens: store.chatMaxCompletionTokens,
            chatServiceTier: store.chatServiceTier,
            chatStream: store.chatStream,
            chatMessagesJson: store.chatMessagesJson,
            chatReasoningEffort: store.chatReasoningEffort,
            chatThinkingType: store.chatThinkingType,
            chatThinkingJson: store.chatThinkingJson,
            chatFrequencyPenalty: store.chatFrequencyPenalty,
            chatPresencePenalty: store.chatPresencePenalty,
            chatTopP: store.chatTopP,
            chatLogprobs: store.chatLogprobs,
            chatTopLogprobs: store.chatTopLogprobs,
            chatParallelToolCalls: store.chatParallelToolCalls,
            chatStopJson: store.chatStopJson,
            chatStreamOptionsJson: store.chatStreamOptionsJson,
            chatResponseFormatJson: store.chatResponseFormatJson,
            chatLogitBiasJson: store.chatLogitBiasJson,
            chatToolsJson: store.chatToolsJson,
            chatToolChoiceJson: store.chatToolChoiceJson,
          },
        })
        Object.assign(properties, {
          ...resolveEffectiveTextGenerationWidgetProperties({
            providerFamily,
            localProperties: nextTextProperties,
            globalProperties: nextTextProperties,
          }),
          prompt: getFlowTextGenerationSeedPrompt(entry.formId),
          output: '',
          title: FLOW_TEXT_GENERATION_NODE_LABEL,
        })
      }
      if (entry.nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
        Object.assign(properties, { output: '', imageUrl: '', videoUrl: '', audioUrl: '', outputSrcDoc: '' })
      }
      if (entry.nodeTypeId === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) {
        Object.assign(properties, { sourceUrl: '', languageHint: '', output: '' })
      }
      if (entry.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
        Object.assign(properties, buildBytePlusVideoWidgetSeedProperties({
          prompt: 'Generate a video responsive to the active request.',
        }))
        properties.reference_image = ''
        properties.videoUrl = ''
      }
      if (entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID) {
        Object.assign(properties, readGrabMapsDiscoveryWidgetProperties())
        if (!args.geospatialWidgetPanelMode) {
          const cursorLngLat = args.widgetDropBridgeOnly ? readGeospatialCursorLngLat() : null
          const cursorLat = cursorLngLat ? Number(cursorLngLat.lat) : Number.NaN
          const cursorLng = cursorLngLat ? Number(cursorLngLat.lng) : Number.NaN
          const nearLat = pickFiniteNumber(properties.nearbyLat)
          const nearLon = pickFiniteNumber(properties.nearbyLon)
          const searchLat = pickFiniteNumber(properties.searchLat)
          const searchLon = pickFiniteNumber(properties.searchLon)
          const geoLat = Number.isFinite(cursorLat) ? cursorLat : (nearLat ?? searchLat)
          const geoLng = Number.isFinite(cursorLng) ? cursorLng : (nearLon ?? searchLon)
          if (geoLat != null && geoLng != null) {
            const geoRaw = isRecord(properties.geo) ? properties.geo : {}
            properties.geo = { ...geoRaw, lat: geoLat, lng: geoLng }
          }
        }
      }
      const base: GraphData =
        args.draftGraphDataRef.current
        || (args.baseGraphData || { context: '', type: 'Graph', nodes: [], edges: [] })
      const used = new Set<string>()
      for (const node of base.nodes || []) addFlowEditorUsedNodeIdVariants(used, node?.id)
      for (const rid of args.reservedNodeIdsRef.current) addFlowEditorUsedNodeIdVariants(used, rid)
      const requestedId = createUniqueId('n', used)
      args.reservedNodeIdsRef.current.add(requestedId)
      const actualId = args.appendDraftNode({ id: requestedId, type: entry.nodeTypeId, label, x, y, properties, skipPendingSelect: true })
      if (!actualId) {
        args.reservedNodeIdsRef.current.delete(requestedId)
        return
      }
      args.reservedNodeIdsRef.current.add(actualId)
      if (args.geospatialWidgetPanelMode) {
        const st = useGraphStore.getState()
        const pinnedMap = st.flowWidgetPinnedByNodeId || {}
        if (pinnedMap[actualId] !== false) st.setFlowWidgetPinnedByNodeId({ ...pinnedMap, [actualId]: false })
      }
      args.setOverlayNodeIdOverride(actualId)
      args.pendingOverlayNodeIdRef.current = actualId
      args.overlayNodeIdOverrideWasSelectedRef.current = false
      args.overlayNodeIdOverrideUntilMsRef.current = Date.now() + OVERLAY_NODE_OVERRIDE_LOCK_MS
      args.lastDroppedWidgetNodeIdRef.current = actualId
      args.setLastDroppedWidgetToken(Date.now())
      openPendingOverlayNode(actualId)
      useGraphStore.setState({
        selectionSource: 'canvas',
        selectedNodeId: actualId,
        selectedEdgeId: null,
        selectedGroupId: null,
        selectedNodeIds: [actualId],
        selectedEdgeIds: [],
        selectedGroupIds: [],
      })
      args.scheduleForceSelect(actualId, { minHoldMs: 700 })
      args.setPendingOverlayNode({ id: actualId, type: entry.nodeTypeId, label, x, y, properties: properties as never })
      args.pendingOpenWidgetNodeIdRef.current = actualId
      if (entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID && !args.geospatialWidgetPanelMode) {
        syncGrabMapsDiscoveryGeoFromDropCursor({ id: actualId, properties })
      }
      if (entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID) {
        void setGeospatialModeEnabled(true).catch(() => void 0)
        if (!args.geospatialWidgetPanelMode) {
          const dropGeo = readFiniteGeoLatLng(properties)
          if (dropGeo) void requestGeospatialCurrentLocation(dropGeo).catch(() => void 0)
        }
      }
    },
    [args, openPendingOverlayNode, syncGrabMapsDiscoveryGeoFromDropCursor],
  )

  const addRichMediaPanelFromMediaAtWorld = React.useCallback((payload: { media: MediaDragPayload; x: number; y: number }) => {
    const mediaUrl = String(payload.media.url || '').trim()
    if (!mediaUrl) return ''
    const x = (Number.isFinite(payload.x) ? payload.x : 0) - RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width / 2
    const y = (Number.isFinite(payload.y) ? payload.y : 0) - RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height / 2
    const label = String(payload.media.label || '').trim() || FLOW_RICH_MEDIA_PANEL_NODE_LABEL
    const base: GraphData = args.draftGraphDataRef.current || (args.baseGraphData || { context: '', type: 'Graph', nodes: [], edges: [] })
    const liveGraphData = useGraphStore.getState().graphData as GraphData | null
    const existingSourceNodeId =
      findRichMediaPanelNodeIdBySourceKey(base, payload.media.sourceKey)
      || findRichMediaPanelNodeIdBySourceKey(liveGraphData, payload.media.sourceKey)
    if (existingSourceNodeId) return existingSourceNodeId
    const used = new Set<string>()
    for (const node of base.nodes || []) addFlowEditorUsedNodeIdVariants(used, node?.id)
    for (const rid of args.reservedNodeIdsRef.current) addFlowEditorUsedNodeIdVariants(used, rid)
    const requestedId = createUniqueId('n', used)
    args.reservedNodeIdsRef.current.add(requestedId)
    const actualId = args.appendDraftNode({
      id: requestedId,
      type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
      label,
      x,
      y,
      fx: x,
      fy: y,
      vx: 0,
      vy: 0,
      properties: buildRichMediaPanelDroppedMediaProperties({ ...payload.media, url: mediaUrl, label }),
      skipPendingSelect: true,
    })
    if (!actualId) {
      args.reservedNodeIdsRef.current.delete(requestedId)
      return ''
    }
    args.reservedNodeIdsRef.current.add(actualId)
    args.setOverlayNodeIdOverride(actualId)
    args.pendingOverlayNodeIdRef.current = actualId
    args.overlayNodeIdOverrideWasSelectedRef.current = false
    args.overlayNodeIdOverrideUntilMsRef.current = Date.now() + OVERLAY_NODE_OVERRIDE_LOCK_MS
    args.lastDroppedWidgetNodeIdRef.current = actualId
    args.setLastDroppedWidgetToken(Date.now())
    openPendingOverlayNode(actualId)
    useGraphStore.setState({ selectionSource: 'canvas', selectedNodeId: actualId, selectedEdgeId: null, selectedGroupId: null, selectedNodeIds: [actualId], selectedEdgeIds: [], selectedGroupIds: [] })
    args.scheduleForceSelect(actualId, { minHoldMs: 700 })
    args.setPendingOverlayNode({ id: actualId, type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, label, x, y, fx: x, fy: y, vx: 0, vy: 0, properties: buildRichMediaPanelDroppedMediaProperties({ ...payload.media, url: mediaUrl, label }) as never })
    args.pendingOpenWidgetNodeIdRef.current = actualId
    // #region debug-point B:widget-drop-bridge-media-panel
    reportStoryboardMediaPanelLoopWidgetDropDebug({
      hypothesisId: 'D',
      location: 'useFlowEditorWidgetDropBridge.ts:add-rich-media-panel',
      msg: 'widget drop bridge created pending rich media panel node',
      data: {
        actualId,
        baseGraphNodeCount: Array.isArray(base?.nodes) ? base.nodes.length : 0,
        liveGraphNodeCount: Array.isArray(liveGraphData?.nodes) ? liveGraphData.nodes.length : 0,
        mediaKind: String(payload.media.kind || '').trim(),
        mediaSourceKey: String(payload.media.sourceKey || '').trim(),
      },
    })
    // #endregion
    return actualId
  }, [args, openPendingOverlayNode])

  React.useEffect(() => {
    if (!(args.active || args.widgetDropCaptureEnabled)) return
    if (typeof document === 'undefined') return
    const readDropRect = (): DOMRect | null => {
      if (args.widgetDropBridgeOnly) {
        const w = typeof window !== 'undefined' ? window.innerWidth : 0
        const h = typeof window !== 'undefined' ? window.innerHeight : 0
        if (!(Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0)) return null
        return {
          left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0,
          toJSON: () => ({}),
        } as DOMRect
      }
      const el = args.rootRef.current
      return el ? el.getBoundingClientRect() : null
    }
    const resolveDropPos = (sx: number, sy: number) => {
      const st = useGraphStore.getState()
      return screenToWorld({
        transform:
          args.getLiveZoomTransform() ||
          getEffectiveZoomStateForKey({
            zoomViewKey: args.zoomViewKeyRef.current,
            zoomStateByKey: st.zoomStateByKey,
            zoomState: st.zoomState,
          }),
        sx,
        sy,
      })
    }
    const appendMediaPanelAtClientPoint = (mediaPayload: MediaDragPayload | null, clientX: number, clientY: number, rect: DOMRect): boolean => {
      if (!mediaPayload) return false
      if (isMediaDropClaimedByNestedTarget(clientX, clientY)) return false
      args.setCanvasWindowOffsetFromRect(rect)
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return false
      const pos = resolveDropPos(sx, sy)
      const mediaUrl = String(mediaPayload.url || '').trim()
      if (!mediaUrl) return false
      const actualId = addRichMediaPanelFromMediaAtWorld({ media: { ...mediaPayload, url: mediaUrl }, x: pos.x, y: pos.y })
      if (!actualId) return false
      args.upsertUiToast({
        id: 'flow-editor-drop-media',
        kind: 'neutral',
        message: 'Created Rich Media Panel node.',
        ttlMs: 1500,
      })
      clearMediaPointerDragPayload()
      return true
    }
    const isMediaPointerDropDistanceAccepted = (detail: MediaPointerDragDropDetail) => {
      if (!Number.isFinite(detail.startClientX) || !Number.isFinite(detail.startClientY)) return true
      const dx = detail.clientX - Number(detail.startClientX)
      const dy = detail.clientY - Number(detail.startClientY)
      return Math.hypot(dx, dy) >= 6
    }
    const appendMediaPanelFromDrop = (ev: DragEvent, rect: DOMRect): boolean =>
      appendMediaPanelAtClientPoint(ev.dataTransfer ? readMediaDragPayload(ev.dataTransfer) : null, ev.clientX, ev.clientY, rect)
    const onDragOverCapture = (ev: DragEvent) => {
      const dt = ev.dataTransfer
      if (!dt || (!hasFlowWidgetDragType(dt) && !hasMediaDragPayload(dt))) return
      const rect = readDropRect()
      if (!rect) return
      const x = ev.clientX
      const y = ev.clientY
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return
      try {
        ev.preventDefault()
        dt.dropEffect = 'copy'
      } catch {
        void 0
      }
    }
    const onDropCapture = (ev: DragEvent) => {
      const dt = ev.dataTransfer
      if (!dt) return
      if (hasMediaDragPayload(dt)) {
        const rect = readDropRect()
        if (!rect) return
        if (!appendMediaPanelFromDrop(ev, rect)) return
        try {
          ev.preventDefault()
          ev.stopPropagation()
          ;(ev as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
        } catch {
          void 0
        }
        return
      }
      const payload = readFlowWidgetDragPayloadFromDataTransfer({ getData: mime => dt.getData(mime) })
      if (!payload) return
      const rect = readDropRect()
      if (!rect) return
      args.setCanvasWindowOffsetFromRect(rect)
      const sx = ev.clientX - rect.left
      const sy = ev.clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
      const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
      if (args.shouldDedupeWidgetDrop(dropKey)) {
        try {
          ev.preventDefault()
          ev.stopPropagation()
          ;(ev as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
        } catch {
          void 0
        }
        return
      }
      const entry = (args.widgetRegistryRef.current || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
      if (!entry) return
      const pos = resolveDropPos(sx, sy)
      addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
      args.upsertUiToast({
        id: 'flow-editor-drop-widget',
        kind: 'neutral',
        message: `Created ${entry.nodeTypeId} node.`,
        ttlMs: 1500,
      })
      try {
        ev.preventDefault()
        ev.stopPropagation()
        ;(ev as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      } catch {
        void 0
      }
    }
    const onMediaPointerDragDropCapture = (event: Event) => {
      const detail = (event as CustomEvent<MediaPointerDragDropDetail>).detail
      if (!detail?.payload || !isMediaPointerDropDistanceAccepted(detail)) return
      if (isMediaPointerDragDropClaimed(detail)) return
      const rect = readDropRect()
      if (!rect) return
      claimMediaPointerDragDrop(detail)
      try {
        event.preventDefault()
        event.stopPropagation()
        ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      } catch {
        void 0
      }
      if (!appendMediaPanelAtClientPoint(detail.payload, detail.clientX, detail.clientY, rect)) {
        detail.__kgMediaPointerDropClaimed = false
        return
      }
    }
    document.addEventListener('dragover', onDragOverCapture, true)
    document.addEventListener('drop', onDropCapture, true)
    window.addEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, onMediaPointerDragDropCapture, true)
    return () => {
      document.removeEventListener('dragover', onDragOverCapture, true)
      document.removeEventListener('drop', onDropCapture, true)
      window.removeEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, onMediaPointerDragDropCapture, true)
    }
  }, [addNodeFromRegistryAtWorld, addRichMediaPanelFromMediaAtWorld, args])

  React.useEffect(() => {
    if (!(args.active || args.widgetDropCaptureEnabled)) return
    if (typeof document === 'undefined') return
    const minPointerDragDistancePx = 6
    const onPointerUpCapture = (ev: PointerEvent) => {
      const session = readActiveFlowWidgetPointerDragSession()
      if (!session || session.pointerId !== ev.pointerId) return
      try {
        clearActiveFlowWidgetPointerDragSession(ev.pointerId)
      } catch {
        void 0
      }
      if (session.nativeDragStarted) return
      const dx = ev.clientX - session.startClientX
      const dy = ev.clientY - session.startClientY
      if (Math.hypot(dx, dy) < minPointerDragDistancePx) return
      const el = args.rootRef.current
      const rect = el ? el.getBoundingClientRect() : null
      if (!rect) return
      const sx = ev.clientX - rect.left
      const sy = ev.clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
      const entry = (args.widgetRegistryRef.current || []).find(e => e && e.isEnabled && e.id === session.registryEntryId) || null
      if (!entry) return
      const dropKey = `${session.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
      if (args.shouldDedupeWidgetDrop(dropKey)) return
      args.setCanvasWindowOffsetFromRect(rect)
      const st = useGraphStore.getState()
      const pos = screenToWorld({
        transform:
          args.getLiveZoomTransform() ||
          getEffectiveZoomStateForKey({
            zoomViewKey: args.zoomViewKeyRef.current,
            zoomStateByKey: st.zoomStateByKey,
            zoomState: st.zoomState,
          }),
        sx,
        sy,
      })
      addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
      args.upsertUiToast({
        id: 'flow-editor-drop-widget',
        kind: 'neutral',
        message: `Created ${entry.nodeTypeId} node.`,
        ttlMs: 1500,
      })
    }
    document.addEventListener('pointerup', onPointerUpCapture, true)
    return () => {
      document.removeEventListener('pointerup', onPointerUpCapture, true)
    }
  }, [addNodeFromRegistryAtWorld, args])

  return { addNodeFromRegistryAtWorld, addRichMediaPanelFromMediaAtWorld }
}
