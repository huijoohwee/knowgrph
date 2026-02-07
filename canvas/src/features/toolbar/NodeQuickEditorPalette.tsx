import React from 'react'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import {
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildFlowNodeQuickEditorDragPayload,
  setFlowNodeQuickEditorDragDataTransfer,
} from '@/lib/flowEditor/nodeQuickEditorDrag'
import FloatingPropsPanelMenuButton from '@/features/toolbar/FloatingPropsPanelMenuButton'

function defaultLabelForEntry(entry: NodeQuickEditorRegistryEntry): string {
  if (entry.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return FLOW_VIDEO_GENERATION_NODE_LABEL
  return entry.nodeTypeId
}

export default function NodeQuickEditorPalette(args: {
  entries: ReadonlyArray<NodeQuickEditorRegistryEntry>
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
      aria-label="Node Quick Editor palette"
      data-main-panel-no-drag="true"
    >
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`} aria-label="Palette header">
        <h4 className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}>Node Quick Editors</h4>
        <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
          Drag into the canvas to create a node.
        </p>
      </header>
      <nav className="min-h-0 overflow-auto p-2" aria-label="Palette items">
        <menu className="m-0 p-0 list-none flex flex-col gap-1" aria-label="Node Quick Editor entries">
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
                    onDragStart={(ev) => {
                      if (!dragEnabled) return
                      const payload = buildFlowNodeQuickEditorDragPayload({ registryEntryId: entry.id })
                      if (!payload) return
                      setFlowNodeQuickEditorDragDataTransfer({ dataTransfer: ev.dataTransfer, payload, label })
                    }}
                  >
                    <span className={`block ${UI_THEME_TOKENS.text.primary}`}>{label}</span>
                    <span className={`block ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
                      {entry.quickEditorTypeId}/{entry.formId}
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
