import React from 'react'

import { Plus, X } from 'lucide-react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import FlowMappingRowsTable from '@/features/flow-editor-manager/FlowMappingRowsTable'
import {
  applyMappingRowsToRegistryEntry,
  buildMappingRowsFromRegistryEntry,
  validateMappingRows,
  type FlowEditorMappingRow,
} from '@/features/flow-editor-manager/mappingRows'

const clean = (v: unknown): string => String(v || '').trim()

const buildBlankDraft = (): Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> => ({
  id: '',
  isEnabled: true,
  nodeTypeId: '',
  quickEditorTypeId: 'default',
  formId: 'default',
  fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
  ports: [],
  schemaMappings: [],
})

export default function NodeQuickEditorRegistryDrawer({
  open,
  mode,
  entryId,
  entries,
  initialDraft,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  mode: 'create' | 'edit'
  entryId: string | null
  entries: NodeQuickEditorRegistryEntry[]
  initialDraft?: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> | null
  onClose: () => void
  onSave: (draft: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> & { updatedAt?: string | null }) =>
    | { ok: true; id: string }
    | { ok: false; message: string }
  onDelete: (id: string) => void
}) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const activeEntry = React.useMemo(() => {
    if (!open) return null
    if (mode !== 'edit') return null
    const id = clean(entryId)
    if (!id) return null
    return (entries || []).find(e => e.id === id) || null
  }, [entries, entryId, mode, open])

  const [draft, setDraft] = React.useState<Omit<NodeQuickEditorRegistryEntry, 'updatedAt'>>(() => buildBlankDraft())
  const [rows, setRows] = React.useState<FlowEditorMappingRow[]>(() =>
    buildMappingRowsFromRegistryEntry({ ...buildBlankDraft(), updatedAt: new Date().toISOString() } as NodeQuickEditorRegistryEntry),
  )
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && activeEntry) {
      const nextDraft = {
        id: activeEntry.id,
        isEnabled: activeEntry.isEnabled,
        nodeTypeId: activeEntry.nodeTypeId,
        quickEditorTypeId: activeEntry.quickEditorTypeId,
        formId: activeEntry.formId,
        fields: Array.isArray(activeEntry.fields) ? activeEntry.fields : [],
        ports: Array.isArray(activeEntry.ports) ? activeEntry.ports : [],
        schemaMappings: Array.isArray(activeEntry.schemaMappings) ? activeEntry.schemaMappings : [],
      }
      setDraft(nextDraft)
      setRows(buildMappingRowsFromRegistryEntry({ ...nextDraft, updatedAt: activeEntry.updatedAt } as NodeQuickEditorRegistryEntry))
      return
    }
    if (mode === 'create' && initialDraft) {
      const nextDraft = {
        id: clean(initialDraft.id),
        isEnabled: !!initialDraft.isEnabled,
        nodeTypeId: clean(initialDraft.nodeTypeId),
        quickEditorTypeId: clean(initialDraft.quickEditorTypeId) || 'default',
        formId: clean(initialDraft.formId) || 'default',
        fields: Array.isArray(initialDraft.fields) ? initialDraft.fields : [],
        ports: Array.isArray(initialDraft.ports) ? initialDraft.ports : [],
        schemaMappings: Array.isArray(initialDraft.schemaMappings) ? initialDraft.schemaMappings : [],
      }
      setDraft(nextDraft)
      setRows(buildMappingRowsFromRegistryEntry({ ...nextDraft, updatedAt: new Date().toISOString() } as NodeQuickEditorRegistryEntry))
      return
    }
    const blank = buildBlankDraft()
    setDraft(blank)
    setRows(buildMappingRowsFromRegistryEntry({ ...blank, updatedAt: new Date().toISOString() } as NodeQuickEditorRegistryEntry))
  }, [activeEntry, initialDraft, mode, open])

  const close = React.useCallback(() => {
    setError(null)
    onClose()
  }, [onClose])

  const validateLocal = React.useCallback((): string | null => {
    const nodeTypeId = clean(draft.nodeTypeId)
    const quickEditorTypeId = clean(draft.quickEditorTypeId)
    const formId = clean(draft.formId)
    if (!nodeTypeId) return 'Node Type is required.'
    if (!quickEditorTypeId) return 'Quick Editor Type is required.'
    if (!formId) return 'Form ID is required.'

    return validateMappingRows(rows)
  }, [draft.formId, draft.nodeTypeId, draft.quickEditorTypeId, rows])

  const addRow = React.useCallback(() => {
    setRows(prev => {
      const used = new Set(prev.map(r => r.id))
      const id = createUniqueId('qerRow', used)
      return [...prev, { id, key: '', type: 'text', value: '', required: false, direction: 'none' }]
    })
  }, [])

  const updateRow = React.useCallback((id: string, patch: Partial<FlowEditorMappingRow>) => {
    const target = clean(id)
    if (!target) return
    setRows(prev => prev.map(r => (r.id === target ? { ...r, ...patch } : r)))
  }, [])

  const deleteRow = React.useCallback((id: string) => {
    const target = clean(id)
    if (!target) return
    setRows(prev => prev.filter(r => r.id !== target))
  }, [])

  const handleSave = React.useCallback(() => {
    const localErr = validateLocal()
    if (localErr) {
      setError(localErr)
      return
    }

    const baseEntry = { ...draft, updatedAt: new Date().toISOString() } as NodeQuickEditorRegistryEntry
    const nextEntry = applyMappingRowsToRegistryEntry({ entry: baseEntry, rows })

    const res = onSave({
      id: clean(draft.id) || undefined,
      isEnabled: !!draft.isEnabled,
      nodeTypeId: clean(draft.nodeTypeId),
      quickEditorTypeId: clean(draft.quickEditorTypeId),
      formId: clean(draft.formId),
      fields: nextEntry.fields,
      ports: nextEntry.ports,
      schemaMappings: (draft.schemaMappings || [])
        .map(m => ({ fromPath: clean(m.fromPath), toPath: clean(m.toPath) }))
        .filter(m => m.fromPath && m.toPath),
    })
    if (res.ok === false) {
      setError(res.message)
      return
    }
    setError(null)
  }, [draft, onSave, rows, validateLocal])

  const handleDelete = React.useCallback(() => {
    const id = clean(draft.id)
    if (!id) return
    onDelete(id)
  }, [draft.id, onDelete])

  if (!open) return null

  return (
    <div className="absolute inset-0 z-20" aria-label="Registry editor">
      <div className="absolute inset-0 bg-black/30" onClick={close} />
      <aside
        className={cn(
          'absolute right-0 top-0 h-full w-full sm:w-[560px] border-l shadow-lg flex flex-col',
          UI_THEME_TOKENS.panel.bg,
          UI_THEME_TOKENS.panel.border,
        )}
      >
        <header className={cn('px-3 py-2 border-b flex items-center justify-between gap-2', UI_THEME_TOKENS.panel.border)}>
          <div className="min-w-0">
            <div className={cn('font-semibold', UI_THEME_TOKENS.text.primary, panelTypography.panelTextClass)}>
              {mode === 'edit' ? 'Edit mapping' : 'Create mapping'}
            </div>
            <div className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
              {mode === 'edit' && draft.id ? draft.id : 'New entry'}
            </div>
          </div>
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={close}
            aria-label={UI_LABELS.close}
          >
            <X className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </button>
        </header>

        <section className="flex-1 min-h-0 overflow-auto px-3 py-3 space-y-4">
          {error && (
            <div className={cn('rounded border px-2 py-2', 'border-red-300/50 bg-red-500/10', panelTypography.microLabelClass)}>
              <div className={cn(UI_THEME_TOKENS.text.primary)}>{error}</div>
            </div>
          )}

          <section aria-label="Identity" className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Identity</h4>
              <label className={cn('inline-flex items-center gap-2', panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                <input
                  type="checkbox"
                  checked={!!draft.isEnabled}
                  onChange={e => setDraft(prev => ({ ...prev, isEnabled: e.target.checked }))}
                />
                Enabled
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="qer-nodeType">
                  Node Type
                </label>
                <input
                  id="qer-nodeType"
                  value={draft.nodeTypeId}
                  onChange={e => setDraft(prev => ({ ...prev, nodeTypeId: e.target.value }))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                />
              </div>
              <div className="sm:col-span-1">
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="qer-editorType">
                  Quick Editor Type
                </label>
                <input
                  id="qer-editorType"
                  value={draft.quickEditorTypeId}
                  onChange={e => setDraft(prev => ({ ...prev, quickEditorTypeId: e.target.value }))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                />
              </div>
              <div className="sm:col-span-1">
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="qer-formId">
                  Form ID
                </label>
                <input
                  id="qer-formId"
                  value={draft.formId}
                  onChange={e => setDraft(prev => ({ ...prev, formId: e.target.value }))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                />
              </div>
            </div>
          </section>

          <section aria-label="Rows" className="space-y-2">
            <section className="flex items-center justify-between gap-2" aria-label="Rows header">
              <h4 className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Rows</h4>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={addRow}
                aria-label="Add row"
              >
                <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </button>
            </section>
            <section className="overflow-auto" aria-label="Rows table">
              <FlowMappingRowsTable rows={rows} onChange={updateRow} onDelete={deleteRow} />
            </section>
          </section>
        </section>

        <footer className={cn('px-3 py-2 border-t flex items-center justify-between gap-2', UI_THEME_TOKENS.panel.border)}>
          <div className="flex items-center gap-2">
            {mode === 'edit' && (
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg, 'text-red-200')}
                onClick={handleDelete}
              >
                {UI_LABELS.delete}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={close}
            >
              {UI_LABELS.cancel}
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`}
              onClick={handleSave}
            >
              {UI_LABELS.save}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
