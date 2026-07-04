import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import {
  FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
  readGrabMapsDiscoveryWidgetProperties,
} from '@/features/storyboard-widget-manager/grabMapsDiscoveryWidget'
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
} from '@/lib/storyboardWidget/widgetDrag'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/storyboard-widget-manager/resolveWidgetRegistry'
import {
  getWidgetRegistryEntryLabel,
  inferTextGenerationProviderFamily,
  resolveEffectiveTextGenerationWidgetProperties,
  resolveTextGenerationGlobalDefaultsForProviderFamily,
} from '@/features/storyboard-widget-manager/registryTemplates'
import { resolveCanvasViewportMeasureElement } from '@/lib/canvas/viewportMeasureElement'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { screenToWorld } from '@/lib/zoom/viewport'
import { requestGeospatialCurrentLocation, setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { readGeospatialCursorLngLat } from '@/lib/gympgrph/api'
import {
  OVERLAY_NODE_OVERRIDE_LOCK_MS,
  isRecord,
  pickFiniteNumber,
  readFiniteGeoLatLng,
} from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import { buildBytePlusImageWidgetSeedProperties } from '@/features/integrations/byteplusImageGenerationDefaults'
import { buildBytePlusVideoWidgetSeedProperties } from '@/features/integrations/byteplusVideoGenerationDefaults'
import { buildRichMediaPanelDroppedMediaProperties } from '@/lib/render/richMediaPanelNode'
import { RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE } from '@/lib/render/richMediaPanelDefaults'
import { setFlowWidgetPinnedById } from '@/lib/storyboardWidget/flowWidgetPinnedState'
import {
  MEDIA_POINTER_DRAG_DROP_EVENT,
  claimMediaPointerDragDrop,
  clearMediaPointerDragPayload,
  hasMediaDragPayload,
  isMediaPointerDragDropClaimed,
  isMediaDropClaimedByNestedTarget,
  readMediaDragPayload,
  resolveMediaDragEventReleaseClientPoint,
  type MediaDragPayload,
  type MediaPointerDragDropDetail,
} from '@/lib/ui/mediaDragPayload'

function addStoryboardWidgetUsedNodeIdVariants(out: Set<string>, rawId: unknown): void {
  const id = String(rawId || '').trim()
  if (!id) return
  out.add(id)
  const parts = id.split('::').map(part => part.trim()).filter(Boolean)
  const suffix = parts.length > 1 ? parts[parts.length - 1] : ''
  if (suffix) out.add(suffix)
}

export function useStoryboardWidgetDropBridge(args: {
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
    skipPendingSelect?: boolean
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
      disableAutoZoomModesForUserGesture(useGraphStore.getState())
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
      for (const node of base.nodes || []) addStoryboardWidgetUsedNodeIdVariants(used, node?.id)
      for (const rid of args.reservedNodeIdsRef.current) addStoryboardWidgetUsedNodeIdVariants(used, rid)
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
        const nextPinnedMap = setFlowWidgetPinnedById(st.flowWidgetPinnedByNodeId, actualId, false)
        if (nextPinnedMap) st.setFlowWidgetPinnedByNodeId(nextPinnedMap)
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
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    const mediaUrl = String(payload.media.url || '').trim()
    if (!mediaUrl) return ''
    const x = (Number.isFinite(payload.x) ? payload.x : 0) - RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width / 2
    const y = (Number.isFinite(payload.y) ? payload.y : 0) - RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height / 2
    const label = String(payload.media.label || '').trim() || FLOW_RICH_MEDIA_PANEL_NODE_LABEL
    const base: GraphData = args.draftGraphDataRef.current || (args.baseGraphData || { context: '', type: 'Graph', nodes: [], edges: [] })
    const used = new Set<string>()
    for (const node of base.nodes || []) addStoryboardWidgetUsedNodeIdVariants(used, node?.id)
    for (const rid of args.reservedNodeIdsRef.current) addStoryboardWidgetUsedNodeIdVariants(used, rid)
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
    return actualId
  }, [args, openPendingOverlayNode])

  React.useEffect(() => {
    if (!(args.active || args.widgetDropCaptureEnabled)) return
    if (typeof document === 'undefined') return
    const deferredDropRafIds = new Set<number>()
    const maxDeferredDropFrames = 8
    const readProjectedRichMediaShellTransform = () => {
      const graphData = args.draftGraphDataRef.current || useGraphStore.getState().graphData || args.baseGraphData || null
      const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
      const readNodeForOverlayId = (overlayId: string) => {
        const cleanOverlayId = String(overlayId || '').trim()
        if (!cleanOverlayId) return null
        return nodes.find(node => {
          const nodeId = String(node?.id || '').trim()
          if (!nodeId) return false
          return nodeId === cleanOverlayId || nodeId.endsWith(`::${cleanOverlayId}`) || cleanOverlayId.endsWith(`::${nodeId}`)
        }) || null
      }
      const shells = Array.from(document.querySelectorAll<HTMLElement>('[data-kg-rich-media-storyboard-widget-overlay-shell="1"][data-node-id]'))
      for (const shell of shells) {
        const rect = shell.getBoundingClientRect()
        if (!(rect.width > 0 && rect.height > 0)) continue
        const node = readNodeForOverlayId(shell.dataset.nodeId)
        const nodeX = typeof node?.x === 'number' && Number.isFinite(node.x) ? node.x : null
        const nodeY = typeof node?.y === 'number' && Number.isFinite(node.y) ? node.y : null
        if (nodeX == null || nodeY == null) continue
        const kx = rect.width / RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width
        const ky = rect.height / RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height
        const k = Number.isFinite(kx) && kx > 0 ? kx : (Number.isFinite(ky) && ky > 0 ? ky : null)
        if (k == null) continue
        const x = rect.left - nodeX * k
        const y = rect.top - nodeY * k
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        return { k, x, y }
      }
      return null
    }
    const readResolvedDropTransform = (opts?: { allowNeutralFallback?: boolean }) => {
      const st = useGraphStore.getState()
      const live = args.getLiveZoomTransform()
      const liveTransform =
        live
        && Number.isFinite(live.k)
        && live.k > 0
        && Number.isFinite(live.x)
        && Number.isFinite(live.y)
          ? { k: live.k, x: live.x, y: live.y }
          : null
      const persisted = getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      })
      const persistedTransform =
        persisted
        && Number.isFinite(persisted.k)
        && persisted.k > 0
        && Number.isFinite(persisted.x)
        && Number.isFinite(persisted.y)
          ? { k: persisted.k, x: persisted.x, y: persisted.y }
          : null
      const liveIsNeutral = !!liveTransform
        && Math.abs(liveTransform.k - 1) <= 1e-3
        && Math.abs(liveTransform.x) <= 0.5
        && Math.abs(liveTransform.y) <= 0.5
      const projectedTransform = readProjectedRichMediaShellTransform()
      if (liveTransform && !liveIsNeutral) return liveTransform
      if (projectedTransform) return projectedTransform
      if (persistedTransform) return persistedTransform
      if (liveTransform && opts?.allowNeutralFallback === true) return liveTransform
      return null
    }
    const readDropRect = (): DOMRect | null => {
      const viewportEl = resolveCanvasViewportMeasureElement(args.rootRef.current)
      if (viewportEl) return viewportEl.getBoundingClientRect()
      if (args.widgetDropBridgeOnly) {
        if (typeof document !== 'undefined') {
          const surfaces = Array.from(document.querySelectorAll<HTMLElement>('[data-kg-storyboard-widget-surface-root]'))
          const activeSurface = surfaces.find(surface => {
            const rect = surface.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          })
          if (activeSurface) return activeSurface.getBoundingClientRect()
        }
        const w = typeof window !== 'undefined' ? window.innerWidth : 0
        const h = typeof window !== 'undefined' ? window.innerHeight : 0
        if (!(Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0)) return null
        return {
          left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0,
          toJSON: () => ({}),
        } as DOMRect
      }
      const el = resolveCanvasViewportMeasureElement(args.rootRef.current)
      return el ? el.getBoundingClientRect() : null
    }
    const resolveDropPos = (sx: number, sy: number, opts?: { allowNeutralFallback?: boolean }) => {
      const transform = readResolvedDropTransform(opts)
      if (!transform) return null
      return screenToWorld({
        transform,
        sx,
        sy,
      })
    }
    const scheduleDeferredDropCommit = (commit: (opts?: { allowNeutralFallback?: boolean }) => 'committed' | 'await-transform' | 'rejected') => {
      if (typeof window === 'undefined') return
      let attempts = 0
      let activeRafId = 0
      const tick = () => {
        if (activeRafId) deferredDropRafIds.delete(activeRafId)
        const allowNeutralFallback = attempts >= maxDeferredDropFrames
        const status = commit({ allowNeutralFallback })
        if (status !== 'await-transform' || allowNeutralFallback) return
        attempts += 1
        activeRafId = window.requestAnimationFrame(tick)
        deferredDropRafIds.add(activeRafId)
      }
      activeRafId = window.requestAnimationFrame(tick)
      deferredDropRafIds.add(activeRafId)
    }
    const appendMediaPanelAtClientPoint = (
      mediaPayload: MediaDragPayload | null,
      clientX: number,
      clientY: number,
      rect: DOMRect,
      opts?: { allowNeutralFallback?: boolean },
    ): 'committed' | 'await-transform' | 'rejected' => {
      if (!mediaPayload) return 'rejected'
      if (isMediaDropClaimedByNestedTarget(clientX, clientY)) return 'rejected'
      args.setCanvasWindowOffsetFromRect(rect)
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return 'rejected'
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return 'rejected'
      const pos = resolveDropPos(sx, sy, opts)
      if (!pos) return 'await-transform'
      const mediaUrl = String(mediaPayload.url || '').trim()
      if (!mediaUrl) return 'rejected'
      const actualId = addRichMediaPanelFromMediaAtWorld({ media: { ...mediaPayload, url: mediaUrl }, x: pos.x, y: pos.y })
      if (!actualId) return 'rejected'
      args.upsertUiToast({
        id: 'storyboard-widget-drop-media',
        kind: 'neutral',
        message: 'Created Rich Media Panel node.',
        ttlMs: 1500,
      })
      clearMediaPointerDragPayload()
      return 'committed'
    }
    const isMediaPointerDropDistanceAccepted = (detail: MediaPointerDragDropDetail) => {
      if (!Number.isFinite(detail.startClientX) || !Number.isFinite(detail.startClientY)) return true
      const dx = detail.clientX - Number(detail.startClientX)
      const dy = detail.clientY - Number(detail.startClientY)
      return Math.hypot(dx, dy) >= 6
    }
    const appendMediaPanelFromDrop = (ev: DragEvent, rect: DOMRect, opts?: { allowNeutralFallback?: boolean }): 'committed' | 'await-transform' | 'rejected' => {
      const release = resolveMediaDragEventReleaseClientPoint(ev)
      return appendMediaPanelAtClientPoint(
        ev.dataTransfer ? readMediaDragPayload(ev.dataTransfer) : null,
        release.clientX,
        release.clientY,
        rect,
        opts,
      )
    }
    const appendDeferredMediaPanelAtClientPoint = (
      mediaPayload: MediaDragPayload | null,
      clientX: number,
      clientY: number,
      opts?: { allowNeutralFallback?: boolean },
    ): 'committed' | 'await-transform' | 'rejected' => {
      const rect = readDropRect()
      if (!rect) return opts?.allowNeutralFallback ? 'rejected' : 'await-transform'
      return appendMediaPanelAtClientPoint(mediaPayload, clientX, clientY, rect, opts)
    }
    const appendDeferredWidgetAtClientPoint = (
      payload: { entry: WidgetRegistryEntry; registryEntryId: string },
      clientX: number,
      clientY: number,
      opts?: { allowNeutralFallback?: boolean },
    ): 'committed' | 'await-transform' | 'rejected' => {
      const rect = readDropRect()
      if (!rect) return opts?.allowNeutralFallback ? 'rejected' : 'await-transform'
      args.setCanvasWindowOffsetFromRect(rect)
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return 'rejected'
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return 'rejected'
      const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
      if (args.shouldDedupeWidgetDrop(dropKey)) return 'rejected'
      const pos = resolveDropPos(sx, sy, opts)
      if (!pos) return 'await-transform'
      addNodeFromRegistryAtWorld({ entry: payload.entry, x: pos.x, y: pos.y })
      args.upsertUiToast({
        id: 'storyboard-widget-drop-widget',
        kind: 'neutral',
        message: `Created ${payload.entry.nodeTypeId} node.`,
        ttlMs: 1500,
      })
      return 'committed'
    }
    const onDragOverCapture = (ev: DragEvent) => {
      const dt = ev.dataTransfer
      if (!dt || (!hasFlowWidgetDragType(dt) && !hasMediaDragPayload(dt))) return
      if (hasMediaDragPayload(dt) && !args.widgetDropBridgeOnly) return
      const rect = readDropRect()
      if (!rect) return
      const x = ev.clientX
      const y = ev.clientY
      if (hasMediaDragPayload(dt) && isMediaDropClaimedByNestedTarget(x, y)) return
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
        if (!args.widgetDropBridgeOnly) return
        const rect = readDropRect()
        if (!rect) return
        const release = resolveMediaDragEventReleaseClientPoint(ev)
        if (isMediaDropClaimedByNestedTarget(release.clientX, release.clientY)) return
        const status = appendMediaPanelFromDrop(ev, rect)
        if (status === 'await-transform') {
          const mediaPayload = readMediaDragPayload(dt)
          scheduleDeferredDropCommit(retryOpts => appendDeferredMediaPanelAtClientPoint(mediaPayload, release.clientX, release.clientY, retryOpts))
        } else if (status !== 'committed') {
          return
        }
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
      const entry = (args.widgetRegistryRef.current || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
      if (!entry) return
      const status = appendDeferredWidgetAtClientPoint({ entry, registryEntryId: payload.registryEntryId }, ev.clientX, ev.clientY)
      if (status === 'await-transform') {
        scheduleDeferredDropCommit(retryOpts => appendDeferredWidgetAtClientPoint({ entry, registryEntryId: payload.registryEntryId }, ev.clientX, ev.clientY, retryOpts))
      } else if (status !== 'committed') {
        try {
          ev.preventDefault()
          ev.stopPropagation()
          ;(ev as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
        } catch {
          void 0
        }
        return
      }
      try {
        ev.preventDefault()
        ev.stopPropagation()
        ;(ev as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      } catch {
        void 0
      }
    }
    const onMediaPointerDragDropCapture = (event: Event) => {
      if (!args.widgetDropBridgeOnly) return
      const detail = (event as CustomEvent<MediaPointerDragDropDetail>).detail
      if (!detail?.payload || !isMediaPointerDropDistanceAccepted(detail)) return
      if (isMediaPointerDragDropClaimed(detail)) return
      if (isMediaDropClaimedByNestedTarget(Number(detail.clientX), Number(detail.clientY))) return
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
      const status = appendMediaPanelAtClientPoint(detail.payload, detail.clientX, detail.clientY, rect)
      if (status === 'await-transform') {
        scheduleDeferredDropCommit(retryOpts => appendDeferredMediaPanelAtClientPoint(detail.payload, detail.clientX, detail.clientY, retryOpts))
        return
      }
      if (status !== 'committed') {
        detail.__kgMediaPointerDropClaimed = false
        return
      }
    }
    document.addEventListener('dragover', onDragOverCapture, true)
    document.addEventListener('drop', onDropCapture, true)
    window.addEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, onMediaPointerDragDropCapture, true)
    return () => {
      if (typeof window !== 'undefined') {
        for (const rafId of deferredDropRafIds) window.cancelAnimationFrame(rafId)
      }
      deferredDropRafIds.clear()
      document.removeEventListener('dragover', onDragOverCapture, true)
      document.removeEventListener('drop', onDropCapture, true)
      window.removeEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, onMediaPointerDragDropCapture, true)
    }
  }, [addNodeFromRegistryAtWorld, addRichMediaPanelFromMediaAtWorld, args])

  React.useEffect(() => {
    if (!(args.active || args.widgetDropCaptureEnabled)) return
    if (typeof document === 'undefined') return
    const minPointerDragDistancePx = 6
    const deferredDropRafIds = new Set<number>()
    const maxDeferredDropFrames = 8
    const readResolvedDropTransform = (opts?: { allowNeutralFallback?: boolean }) => {
      const st = useGraphStore.getState()
      const live = args.getLiveZoomTransform()
      const liveTransform =
        live
        && Number.isFinite(live.k)
        && live.k > 0
        && Number.isFinite(live.x)
        && Number.isFinite(live.y)
          ? { k: live.k, x: live.x, y: live.y }
          : null
      const persisted = getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      })
      const persistedTransform =
        persisted
        && Number.isFinite(persisted.k)
        && persisted.k > 0
        && Number.isFinite(persisted.x)
        && Number.isFinite(persisted.y)
          ? { k: persisted.k, x: persisted.x, y: persisted.y }
          : null
      const liveIsNeutral = !!liveTransform
        && Math.abs(liveTransform.k - 1) <= 1e-3
        && Math.abs(liveTransform.x) <= 0.5
        && Math.abs(liveTransform.y) <= 0.5
      if (liveTransform && !liveIsNeutral) return liveTransform
      if (persistedTransform) return persistedTransform
      if (liveTransform && opts?.allowNeutralFallback === true) return liveTransform
      return null
    }
    const resolvePointerDropPos = (clientX: number, clientY: number, opts?: { allowNeutralFallback?: boolean }) => {
      const rect = resolveCanvasViewportMeasureElement(args.rootRef.current)?.getBoundingClientRect() || null
      if (!rect) return { rect: null, pos: null }
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) {
        return { rect, pos: null }
      }
      const transform = readResolvedDropTransform(opts)
      if (!transform) return { rect, pos: null }
      return {
        rect,
        pos: screenToWorld({
          transform,
          sx,
          sy,
        }),
      }
    }
    const scheduleDeferredWidgetCommit = (commit: (opts?: { allowNeutralFallback?: boolean }) => 'committed' | 'await-transform' | 'rejected') => {
      if (typeof window === 'undefined') return
      let attempts = 0
      let activeRafId = 0
      const tick = () => {
        if (activeRafId) deferredDropRafIds.delete(activeRafId)
        const allowNeutralFallback = attempts >= maxDeferredDropFrames
        const status = commit({ allowNeutralFallback })
        if (status !== 'await-transform' || allowNeutralFallback) return
        attempts += 1
        activeRafId = window.requestAnimationFrame(tick)
        deferredDropRafIds.add(activeRafId)
      }
      activeRafId = window.requestAnimationFrame(tick)
      deferredDropRafIds.add(activeRafId)
    }
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
      const entry = (args.widgetRegistryRef.current || []).find(e => e && e.isEnabled && e.id === session.registryEntryId) || null
      if (!entry) return
      const commitWidget = (opts?: { allowNeutralFallback?: boolean }): 'committed' | 'await-transform' | 'rejected' => {
        const { rect, pos } = resolvePointerDropPos(ev.clientX, ev.clientY, opts)
        if (!rect) return opts?.allowNeutralFallback ? 'rejected' : 'await-transform'
        const sx = ev.clientX - rect.left
        const sy = ev.clientY - rect.top
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return 'rejected'
        const dropKey = `${session.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
        if (args.shouldDedupeWidgetDrop(dropKey)) return 'rejected'
        if (!pos) return 'await-transform'
        args.setCanvasWindowOffsetFromRect(rect)
        addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
        args.upsertUiToast({
          id: 'storyboard-widget-drop-widget',
          kind: 'neutral',
          message: `Created ${entry.nodeTypeId} node.`,
          ttlMs: 1500,
        })
        return 'committed'
      }
      const status = commitWidget()
      if (status === 'await-transform') {
        scheduleDeferredWidgetCommit(commitWidget)
      }
    }
    document.addEventListener('pointerup', onPointerUpCapture, true)
    return () => {
      if (typeof window !== 'undefined') {
        for (const rafId of deferredDropRafIds) window.cancelAnimationFrame(rafId)
      }
      deferredDropRafIds.clear()
      document.removeEventListener('pointerup', onPointerUpCapture, true)
    }
  }, [addNodeFromRegistryAtWorld, args])

  return { addNodeFromRegistryAtWorld, addRichMediaPanelFromMediaAtWorld }
}
