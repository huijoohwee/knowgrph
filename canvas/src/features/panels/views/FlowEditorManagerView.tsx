import React from 'react'

import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { normalized as normalizeText } from '@/features/panels/utils/json'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import NodeQuickEditorRegistryTable from '@/features/flow-editor-manager/NodeQuickEditorRegistryTable'
import NodeQuickEditorRegistryDrawer from '@/features/flow-editor-manager/NodeQuickEditorRegistryDrawer'

export default function FlowEditorManagerView({ searchQuery }: { searchQuery: string }) {
  const panelTypography = usePanelTypography()
  const {
    nodeQuickEditorRegistry,
    upsertNodeQuickEditorRegistryEntry,
    removeNodeQuickEditorRegistryEntry,
    toggleNodeQuickEditorRegistryEntryEnabled,
  } = useGraphStore(
    useShallow(s => ({
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry,
      upsertNodeQuickEditorRegistryEntry: s.upsertNodeQuickEditorRegistryEntry,
      removeNodeQuickEditorRegistryEntry: s.removeNodeQuickEditorRegistryEntry,
      toggleNodeQuickEditorRegistryEntryEnabled: s.toggleNodeQuickEditorRegistryEntryEnabled,
    })),
  )

  const normalizedQuery = normalizeText(searchQuery).trim()
  const [enabledOnly, setEnabledOnly] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [drawer, setDrawer] = React.useState<{ mode: 'create' | 'edit'; id: string | null } | null>(null)

  const filtered = React.useMemo(() => {
    const src = Array.isArray(nodeQuickEditorRegistry) ? nodeQuickEditorRegistry : []
    const enabledFiltered = enabledOnly ? src.filter(e => e.isEnabled) : src
    if (!normalizedQuery) return enabledFiltered
    return enabledFiltered.filter(e =>
      normalizeText([e.nodeTypeId, e.quickEditorTypeId, e.formId, e.id].join(' ')).includes(normalizedQuery),
    )
  }, [enabledOnly, nodeQuickEditorRegistry, normalizedQuery])

  const emptyLabel = React.useMemo(() => {
    if (!normalizedQuery && !enabledOnly) return 'No mappings yet.'
    return 'No mappings match.'
  }, [enabledOnly, normalizedQuery])

  const selected = React.useMemo(() => {
    const id = String(selectedId || '').trim()
    if (!id) return null
    return (nodeQuickEditorRegistry || []).find(e => e.id === id) || null
  }, [nodeQuickEditorRegistry, selectedId])

  React.useEffect(() => {
    if (!selectedId) return
    if (selected) return
    setSelectedId(null)
  }, [selected, selectedId])

  const openCreate = React.useCallback(() => {
    setDrawer({ mode: 'create', id: null })
  }, [])

  const openEdit = React.useCallback((id: string) => {
    const clean = String(id || '').trim()
    if (!clean) return
    setDrawer({ mode: 'edit', id: clean })
  }, [])

  const closeDrawer = React.useCallback(() => setDrawer(null), [])

  const handleSave = React.useCallback(
    (draft: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> & { updatedAt?: string | null }) => {
      const res = upsertNodeQuickEditorRegistryEntry({
        id: draft.id,
        isEnabled: draft.isEnabled,
        nodeTypeId: draft.nodeTypeId,
        quickEditorTypeId: draft.quickEditorTypeId,
        formId: draft.formId,
        fields: draft.fields,
        ports: draft.ports,
        ...(Array.isArray(draft.schemaMappings) ? { schemaMappings: draft.schemaMappings } : {}),
      })
      if (!res.ok) return res
      setSelectedId(res.id)
      setDrawer(null)
      return res
    },
    [upsertNodeQuickEditorRegistryEntry],
  )

  const handleDelete = React.useCallback(
    (id: string) => {
      const clean = String(id || '').trim()
      if (!clean) return
      removeNodeQuickEditorRegistryEntry(clean)
      setSelectedId(prev => (prev === clean ? null : prev))
      setDrawer(null)
    },
    [removeNodeQuickEditorRegistryEntry],
  )

  return (
    <article className="h-full min-h-0 flex flex-col relative">
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}>
              {UI_LABELS.flowEditorManager}
            </h3>
            <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
              Node Quick Editor Registry
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className={`inline-flex items-center gap-2 ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
              <input
                type="checkbox"
                checked={enabledOnly}
                onChange={e => setEnabledOnly(e.target.checked)}
              />
              Enabled only
            </label>
            <button
              type="button"
              className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={openCreate}
            >
              {UI_LABELS.add} mapping
            </button>
          </div>
        </div>
      </header>

      <section className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_320px]">
          <div className="min-h-0 overflow-hidden">
            <NodeQuickEditorRegistryTable
              entries={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onEdit={openEdit}
              onToggleEnabled={toggleNodeQuickEditorRegistryEntryEnabled}
              emptyLabel={emptyLabel}
            />
          </div>
          <aside className={`hidden xl:block min-h-0 border-l ${UI_THEME_TOKENS.panel.border} overflow-auto`} aria-label="Registry detail">
            <div className="p-3">
              {selected ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`font-semibold ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass} truncate`}>
                        {selected.nodeTypeId}
                      </div>
                      <div className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary} break-all`}>
                        {selected.quickEditorTypeId} · {selected.formId}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                      onClick={() => openEdit(selected.id)}
                    >
                      {UI_LABELS.edit}
                    </button>
                  </div>

                  <div className="mt-3">
                    <h4 className={`text-xs font-semibold uppercase tracking-wider ${UI_THEME_TOKENS.text.secondary}`}>Fields</h4>
                    <ul className="mt-2 space-y-1">
                      {selected.fields.map(f => (
                        <li key={f.fieldKey} className={`text-sm ${UI_THEME_TOKENS.text.primary}`}>
                          <span className="font-semibold">{f.fieldKey}</span>
                          <span className={`ml-2 ${UI_THEME_TOKENS.text.secondary}`}>{f.fieldType}</span>
                          {f.schemaPath ? (
                            <span className={`ml-2 ${panelTypography.monospaceTextClass} ${UI_THEME_TOKENS.text.tertiary}`}>{f.schemaPath}</span>
                          ) : null}
                        </li>
                      ))}
                      {selected.fields.length === 0 && (
                        <li className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary}`}>No fields.</li>
                      )}
                    </ul>
                  </div>

                  <div className="mt-4">
                    <h4 className={`text-xs font-semibold uppercase tracking-wider ${UI_THEME_TOKENS.text.secondary}`}>Ports</h4>
                    <ul className="mt-2 space-y-1">
                      {selected.ports.map((p, idx) => (
                        <li key={`${p.direction}:${p.portKey}:${idx}`} className={`text-sm ${UI_THEME_TOKENS.text.primary}`}>
                          <span className="font-semibold">{p.direction}</span>
                          <span className={`ml-2 ${panelTypography.monospaceTextClass}`}>{p.portKey}</span>
                          {p.schemaPath ? (
                            <span className={`ml-2 ${panelTypography.monospaceTextClass} ${UI_THEME_TOKENS.text.tertiary}`}>{p.schemaPath}</span>
                          ) : null}
                        </li>
                      ))}
                      {selected.ports.length === 0 && (
                        <li className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary}`}>No ports.</li>
                      )}
                    </ul>
                  </div>
                </>
              ) : (
                <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>Select a mapping to inspect details.</p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <NodeQuickEditorRegistryDrawer
        open={!!drawer}
        mode={drawer?.mode || 'create'}
        entryId={drawer?.id || null}
        entries={nodeQuickEditorRegistry}
        onClose={closeDrawer}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </article>
  )
}
