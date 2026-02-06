import React from 'react'

import { Plus, RotateCcw, Save } from 'lucide-react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { createUniqueId } from '@/lib/ids'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import {
  applyMappingRowsToRegistryEntry,
  buildMappingRowsFromRegistryEntry,
  validateMappingRows,
  type FlowEditorMappingRow,
} from '@/features/flow-editor-manager/mappingRows'

import FlowMappingRowsTable from '@/features/flow-editor-manager/FlowMappingRowsTable'

const clean = (v: unknown): string => String(v || '').trim()

export default function FlowMappingRowsEditor({
  entry,
  onSaveEntry,
}: {
  entry: NodeQuickEditorRegistryEntry
  onSaveEntry: (next: NodeQuickEditorRegistryEntry) => void
}) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const [rows, setRows] = React.useState<FlowEditorMappingRow[]>(() => buildMappingRowsFromRegistryEntry(entry))
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setError(null)
    setRows(buildMappingRowsFromRegistryEntry(entry))
  }, [entry.id, entry.updatedAt])

  const addRow = React.useCallback(() => {
    setRows(prev => {
      const used = new Set(prev.map(r => r.id))
      const id = createUniqueId('qerRow', used)
      return [...prev, { id, key: '', type: 'text', value: '', required: false, direction: 'none' }]
    })
  }, [])

  const reset = React.useCallback(() => {
    setError(null)
    setRows(buildMappingRowsFromRegistryEntry(entry))
  }, [entry])

  const commit = React.useCallback(() => {
    const err = validateMappingRows(rows)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    onSaveEntry(applyMappingRowsToRegistryEntry({ entry, rows }))
  }, [entry, onSaveEntry, rows])

  const updateRow = React.useCallback((id: string, patch: Partial<FlowEditorMappingRow>) => {
    const target = clean(id)
    if (!target) return
    setRows(prev => prev.map(r => (r.id === target ? { ...r, ...patch } : r)))
  }, [])

  const removeRow = React.useCallback((id: string) => {
    const target = clean(id)
    if (!target) return
    setRows(prev => prev.filter(r => r.id !== target))
  }, [])

  return (
    <section aria-label="Edit mapping" className="min-h-0 flex flex-col">
      <header className="flex items-start justify-between gap-2">
        <section className="min-w-0" aria-label="Mapping header">
          <h4 className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}>Edit mapping</h4>
          <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary} break-all`}>
            {entry.nodeTypeId} · {entry.quickEditorTypeId} · {entry.formId}
          </p>
        </section>
        <menu className="m-0 p-0 list-none flex items-center gap-1" aria-label="Mapping actions">
          <li>
            <button
              type="button"
              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={addRow}
              aria-label="Add row"
              title="Add row"
            >
              <Plus className={`${iconSizeClass}`} strokeWidth={uiIconStrokeWidth} />
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={reset}
              aria-label="Reset"
              title="Reset"
            >
              <RotateCcw className={`${iconSizeClass}`} strokeWidth={uiIconStrokeWidth} />
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={commit}
              aria-label="Save"
              title="Save"
            >
              <Save className={`${iconSizeClass}`} strokeWidth={uiIconStrokeWidth} />
            </button>
          </li>
        </menu>
      </header>

      {error ? (
        <p className={`mt-2 ${panelTypography.microLabelClass} text-red-700 dark:text-red-400`} role="status">
          {error}
        </p>
      ) : null}

      <section className="mt-3 min-h-0 overflow-auto" aria-label="Mapping table">
        <FlowMappingRowsTable rows={rows} onChange={updateRow} onDelete={removeRow} />
      </section>
    </section>
  )
}
