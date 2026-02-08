import React from 'react'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'

export default function NodeQuickEditorRegistryTable({
  entries,
  selectedId,
  onSelect,
  onToggleEnabled,
  emptyLabel,
}: {
  entries: NodeQuickEditorRegistryEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onToggleEnabled: (id: string, enabled?: boolean) => void
  emptyLabel?: string
}) {
  const panelTypography = usePanelTypography()
  const selected = String(selectedId || '').trim()

  return (
    <div className="h-full min-h-0 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className={cn(UI_THEME_TOKENS.panel.bg, `border-b ${UI_THEME_TOKENS.panel.border}`)}>
            <th className={cn('text-left px-3 py-2 text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>Enabled</th>
            <th className={cn('text-left px-3 py-2 text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>Node Type</th>
            <th className={cn('text-left px-3 py-2 text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>Editor</th>
            <th className={cn('text-left px-3 py-2 text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>Form</th>
            <th className={cn('text-left px-3 py-2 text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>Fields</th>
            <th className={cn('text-left px-3 py-2 text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>Ports</th>
            <th className={cn('text-left px-3 py-2 text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>Updated</th>
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
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!e.isEnabled}
                    onChange={ev => onToggleEnabled(e.id, ev.target.checked)}
                    onClick={ev => ev.stopPropagation()}
                    aria-label="Toggle enabled"
                  />
                </td>
                <td className={cn('px-3 py-2 text-sm', UI_THEME_TOKENS.text.primary)}>
                  <div className="max-w-[260px] truncate" title={e.nodeTypeId}>
                    {e.nodeTypeId}
                  </div>
                </td>
                <td className={cn('px-3 py-2 text-sm', UI_THEME_TOKENS.text.secondary)}>
                  <div className="max-w-[180px] truncate" title={e.quickEditorTypeId}>
                    {e.quickEditorTypeId}
                  </div>
                </td>
                <td className={cn('px-3 py-2 text-sm', UI_THEME_TOKENS.text.secondary)}>
                  <div className={cn('max-w-[160px] truncate', panelTypography.monospaceTextClass)} title={e.formId}>
                    {e.formId}
                  </div>
                </td>
                <td className={cn('px-3 py-2 text-sm', UI_THEME_TOKENS.text.secondary)}>
                  {Array.isArray(e.fields) ? e.fields.length : 0}
                </td>
                <td className={cn('px-3 py-2 text-sm', UI_THEME_TOKENS.text.secondary)}>
                  {Array.isArray(e.ports) ? e.ports.length : 0}
                </td>
                <td className={cn('px-3 py-2 text-xs', UI_THEME_TOKENS.text.tertiary)}>
                  <span className={cn(panelTypography.monospaceTextClass)}>{String(e.updatedAt || '').slice(0, 19).replace('T', ' ')}</span>
                </td>
              </tr>
            )
          })}

          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className={cn('px-3 py-6 text-center', panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                {emptyLabel || 'No mappings yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
