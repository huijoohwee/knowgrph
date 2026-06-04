import React from 'react'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import {
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_EMPTY_CELL_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_TABLE_EDITOR_TEXT_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_TABLE_FORM_TEXT_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_TABLE_NODE_TEXT_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { cn } from '@/lib/utils'

import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export default function WidgetRegistryTable({
  entries,
  selectedId,
  onSelect,
  onToggleEnabled,
  emptyLabel,
}: {
  entries: WidgetRegistryEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onToggleEnabled: (id: string, enabled?: boolean) => void
  emptyLabel?: string
}) {
  const panelTypography = usePanelTypography()
  const selected = String(selectedId || '').trim()

  return (
    <section className="h-full min-h-0 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className={cn(UI_THEME_TOKENS.panel.bg, `border-b ${UI_THEME_TOKENS.panel.border}`)}>
            <th className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME, 'text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>
              Enabled
            </th>
            <th className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME, 'text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>
              Node Type
            </th>
            <th className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME, 'text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>
              Editor
            </th>
            <th className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME, 'text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>
              Form
            </th>
            <th className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME, 'text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>
              Fields
            </th>
            <th className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME, 'text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>
              Ports
            </th>
            <th className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_HEADER_CELL_CLASSNAME, 'text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => {
            const isSelected = selected && e.id === selected
            return (
              <tr
                key={e.id}
                className={cn(
                  `border-b ${UI_THEME_TOKENS.panel.border}`,
                  isSelected ? UI_THEME_TOKENS.table.rowHover : '',
                  'cursor-pointer',
                )}
                onClick={() => onSelect(e.id)}
              >
                <td className={UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME}>
                  <input
                    type="checkbox"
                    checked={!!e.isEnabled}
                    onChange={ev => onToggleEnabled(e.id, ev.target.checked)}
                    onClick={ev => ev.stopPropagation()}
                    aria-label="Toggle enabled"
                  />
                </td>
                <td className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME, 'text-sm', UI_THEME_TOKENS.text.primary)}>
                  <section className={UI_RESPONSIVE_FLOW_MANAGER_TABLE_NODE_TEXT_CLASSNAME} title={e.nodeTypeId}>
                    {e.nodeTypeId}
                  </section>
                </td>
                <td className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME, 'text-sm', UI_THEME_TOKENS.text.secondary)}>
                  <section className={UI_RESPONSIVE_FLOW_MANAGER_TABLE_EDITOR_TEXT_CLASSNAME} title={e.widgetTypeId}>
                    {e.widgetTypeId}
                  </section>
                </td>
                <td className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME, 'text-sm', UI_THEME_TOKENS.text.secondary)}>
                  <section className={cn(UI_RESPONSIVE_FLOW_MANAGER_TABLE_FORM_TEXT_CLASSNAME, panelTypography.monospaceTextClass)} title={e.formId}>
                    {e.formId}
                  </section>
                </td>
                <td className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME, 'text-sm', UI_THEME_TOKENS.text.secondary)}>
                  {Array.isArray(e.fields) ? e.fields.length : 0}
                </td>
                <td className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME, 'text-sm', UI_THEME_TOKENS.text.secondary)}>
                  {Array.isArray(e.ports) ? e.ports.length : 0}
                </td>
                <td className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_CELL_CLASSNAME, 'text-xs', UI_THEME_TOKENS.text.tertiary)}>
                  <span className={cn(panelTypography.monospaceTextClass)}>{String(e.updatedAt || '').slice(0, 19).replace('T', ' ')}</span>
                </td>
              </tr>
            )
          })}

          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_TABLE_EMPTY_CELL_CLASSNAME, panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {emptyLabel || 'No mappings yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
