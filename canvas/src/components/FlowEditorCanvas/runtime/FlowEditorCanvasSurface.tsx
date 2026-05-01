import React from 'react'

import FlowCanvas from '@/components/FlowCanvas'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { readFlowWidgetDragPayloadFromDataTransfer } from '@/lib/flowEditor/widgetDrag'
import { screenToWorld } from '@/lib/zoom/viewport'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export default function FlowEditorCanvasSurface(props: {
  rootRef: React.RefObject<HTMLElement | null>
  flowEditorSurfaceId: string
  active: boolean
  canEdit: boolean
  geospatialWidgetPanelMode?: boolean
  renderGraphDataOverride: GraphData | null
  flowEditorViewActive: boolean
  draftGraphDataRevision: number
  baseGraphDataRevision: number
  flowRuntimeRefRef: React.MutableRefObject<React.MutableRefObject<any> | null>
  hasOverlayEditors: boolean
  emitFlowEditorInteractionFrame: () => void
  overlayOnlyActive: boolean
  overlayOnlyHidePortHandleNodeIds?: string[]
  overlayEditorNodeIds: string[]
  overlayEdgesSvgRef: React.Ref<SVGSVGElement>
  overlayEditorElements: React.ReactNode
  noGraphLoaded: boolean
  toolMode: 'select' | 'addEdge'
  pendingEdgeSourceId: string | null
  inspectorPortalHost: HTMLElement | null
  inspectorElement: React.ReactNode
  widgetRegistry: ReadonlyArray<WidgetRegistryEntry>
  shouldDedupeWidgetDrop: (key: string) => boolean
  setCanvasWindowOffsetFromRect: (rect: DOMRect) => void
  getLiveZoomTransform: () => { k: number; x: number; y: number } | null
  zoomViewKeyRef: React.MutableRefObject<string | null>
  addNodeFromRegistryAtWorld: (args: { entry: WidgetRegistryEntry; x: number; y: number }) => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  createPortal: typeof import('react-dom').createPortal
}) {
  return (
    <section
      ref={props.rootRef}
      className={`absolute inset-0 z-0 ${props.geospatialWidgetPanelMode ? 'pointer-events-none' : ''}`}
      aria-label="Flow Editor"
      data-kg-flow-editor-surface-root={props.flowEditorSurfaceId}
      onDragOverCapture={(ev) => {
        if (props.geospatialWidgetPanelMode || !props.canEdit) return
        ev.preventDefault()
        try {
          ev.dataTransfer.dropEffect = 'copy'
        } catch {
          void 0
        }
      }}
      onDropCapture={(ev) => {
        if (props.geospatialWidgetPanelMode || !props.canEdit) return
        const payload = readFlowWidgetDragPayloadFromDataTransfer({ getData: mime => ev.dataTransfer.getData(mime) })
        if (!payload) return
        const entry = (props.widgetRegistry || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
        if (!entry) return
        const el = props.rootRef.current
        const rect = el ? el.getBoundingClientRect() : null
        if (!rect) return
        props.setCanvasWindowOffsetFromRect(rect)
        const sx = ev.clientX - rect.left
        const sy = ev.clientY - rect.top
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
        const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
        if (props.shouldDedupeWidgetDrop(dropKey)) {
          ev.preventDefault()
          ev.stopPropagation()
          return
        }
        const st = useGraphStore.getState()
        const pos = screenToWorld({
          transform:
            props.getLiveZoomTransform() ||
            getEffectiveZoomStateForKey({
              zoomViewKey: props.zoomViewKeyRef.current,
              zoomStateByKey: st.zoomStateByKey,
              zoomState: st.zoomState,
            }),
          sx,
          sy,
        })
        props.addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
        props.upsertUiToast({
          id: 'flow-editor-drop-widget',
          kind: 'neutral',
          message: `Created ${entry.nodeTypeId} node.`,
          ttlMs: 1500,
        })
        ev.preventDefault()
        ev.stopPropagation()
      }}
    >
      <FlowCanvas
        active={props.active}
        flowEditorSurfaceId={props.flowEditorSurfaceId}
        allowNodeDragOverride={props.canEdit}
        graphDataOverride={props.renderGraphDataOverride}
        graphDataRevisionOverride={props.flowEditorViewActive ? props.draftGraphDataRevision : props.baseGraphDataRevision}
        exposeRuntimeRef={ref => {
          props.flowRuntimeRefRef.current = ref
        }}
        onInteractionFrame={props.hasOverlayEditors ? props.emitFlowEditorInteractionFrame : undefined}
        renderEdges={!props.overlayOnlyActive}
        renderGroups={!props.geospatialWidgetPanelMode}
        renderNodes={!props.overlayOnlyActive}
        hidePortHandleNodeIds={props.overlayOnlyHidePortHandleNodeIds}
        excludeRichMediaOverlayNodeIds={props.overlayEditorNodeIds}
      />

      {props.overlayOnlyActive && (
        <svg
          ref={props.overlayEdgesSvgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 120, color: 'var(--kg-canvas-edge-stroke, #9ca3af)', overflow: 'visible', opacity: 1, visibility: 'visible' }}
          aria-hidden={true}
        />
      )}

      {props.overlayEditorElements}

      {props.noGraphLoaded && !props.geospatialWidgetPanelMode && (
        <aside className="absolute top-3 left-3 z-[220]" aria-label="Flow Editor Status">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>No graph loaded.</p>
          </section>
        </aside>
      )}

      {!props.hasOverlayEditors && props.toolMode === 'addEdge' && props.canEdit && (
        <aside className="absolute top-16 left-3 z-[220]" aria-label="Add edge hint">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>
              {props.pendingEdgeSourceId ? `Select target node (from ${props.pendingEdgeSourceId}).` : 'Select source node.'}
            </p>
          </section>
        </aside>
      )}

      {props.inspectorPortalHost ? props.createPortal(props.inspectorElement, props.inspectorPortalHost) : null}
    </section>
  )
}
