import React from 'react'

import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  FLOW_IMAGE_GENERATION_NODE_LABEL,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  beginFlowWidgetPointerDragSession,
  buildFlowWidgetDragPayload,
  clearActiveFlowWidgetPointerDragSession,
  markFlowWidgetPointerDragNativeStart,
  setFlowWidgetDragDataTransfer,
} from '@/lib/flowEditor/widgetDrag'
import FloatingPropsPanelMenuButton from '@/features/toolbar/FloatingPropsPanelMenuButton'
import { getWidgetRegistryEntryLabel } from '@/features/flow-editor-manager/registryTemplates'

function defaultLabelForEntry(entry: WidgetRegistryEntry): string {
  return getWidgetRegistryEntryLabel({
    nodeTypeId: entry.nodeTypeId,
    widgetTypeId: entry.widgetTypeId,
    formId: entry.formId,
  })
}

export default function WidgetPalette(args: {
  entries: ReadonlyArray<WidgetRegistryEntry>
  dragEnabled: boolean
}) {
  const panelTypography = usePanelTypography()
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const entries = Array.isArray(args.entries) ? args.entries : []
  const dragEnabled = args.dragEnabled === true

  return (
    <aside
      className="min-h-0 overflow-hidden"
      aria-label="Widget palette"
      data-main-panel-no-drag="true"
    >
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`} aria-label="Palette header">
        <h4 className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}>Widgets</h4>
        <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
          Drag into the canvas to create a ready-to-Run widget node.
        </p>
      </header>
      <nav className="min-h-0 overflow-auto p-2" aria-label="Palette items">
        <menu className="m-0 p-0 list-none flex flex-col gap-1" aria-label="Widget entries">
          {entries.length === 0 ? (
            <li className={`px-2 py-2 ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>No enabled entries.</li>
          ) : (
            entries.map(entry => {
              const label = defaultLabelForEntry(entry)
              const disabled = !dragEnabled
              return (
                <li key={entry.id}>
                  <FloatingPropsPanelMenuButton
                    disabled={disabled}
                    draggable={dragEnabled}
                    uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
                    uiPanelTextFontClass={uiPanelTextFontClass}
                    ariaLabel={`Drag ${label}`}
                    title={`Drag to canvas: ${label}`}
                    onPointerDownCapture={(ev) => {
                      if (!dragEnabled) return
                      beginFlowWidgetPointerDragSession({
                        registryEntryId: entry.id,
                        label,
                        pointerId: ev.pointerId,
                        clientX: ev.clientX,
                        clientY: ev.clientY,
                      })
                    }}
                    onDragStart={(ev) => {
                      if (!dragEnabled) return
                      markFlowWidgetPointerDragNativeStart()
                      const payload = buildFlowWidgetDragPayload({ registryEntryId: entry.id })
                      if (!payload) return
                      setFlowWidgetDragDataTransfer({ dataTransfer: ev.dataTransfer, payload, label })
                    }}
                    onDragEnd={(ev) => {
                      clearActiveFlowWidgetPointerDragSession()
                    }}
                  >
                    <span className={`block ${UI_THEME_TOKENS.text.primary}`}>{label}</span>
                    <span className={`block ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
                      {entry.widgetTypeId}/{entry.formId}
                    </span>
                  </FloatingPropsPanelMenuButton>
                </li>
              )
            })
          )}
        </menu>
      </nav>
    </aside>
  )
}
