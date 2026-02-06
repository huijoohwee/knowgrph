import React from 'react'

import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import {
  FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  UI_COPY,
  UI_LABELS,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { pickFilesWithExtensions } from '@/lib/graph/filePicker'
import { downloadBlob } from '@/lib/graph/save'
import { buildNodeQuickEditorBundleV1, nodeQuickEditorBundleToJsonBlob } from '@/lib/graph/io/nodeQuickEditorBundle'
import { normalizeNodeQuickEditorRegistryEntries, validateNodeQuickEditorRegistryEntry } from '@/hooks/store/flowEditorManagerSlice'
import { tryParseQuickEditorImportGraphData } from '@/lib/graph/io/quickEditorImport'
import {
  buildGenerateVideoRegistryDraft,
  buildNodeQuickEditorDraftFromSmartFields,
} from '@/features/flow-editor-manager/registryTemplates'
import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import NodeQuickEditorRegistryTable from '@/features/flow-editor-manager/NodeQuickEditorRegistryTable'
import NodeQuickEditorRegistryDrawer from '@/features/flow-editor-manager/NodeQuickEditorRegistryDrawer'
import FlowMappingRowsEditor from '@/features/flow-editor-manager/FlowMappingRowsEditor'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export default function FlowEditorMappingTab({ searchQuery }: { searchQuery: string }) {
  const panelTypography = usePanelTypography()
  const {
    nodeQuickEditorRegistry,
    setNodeQuickEditorRegistry,
    graphData,
    selectedNodeId,
    updateNode,
    upsertUiToast,
    upsertNodeQuickEditorRegistryEntry,
    removeNodeQuickEditorRegistryEntry,
    toggleNodeQuickEditorRegistryEntryEnabled,
  } = useGraphStore(
    useShallow(s => ({
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry,
      setNodeQuickEditorRegistry: s.setNodeQuickEditorRegistry,
      graphData: s.graphData,
      selectedNodeId: s.selectedNodeId,
      updateNode: s.updateNode,
      upsertUiToast: s.upsertUiToast,
      upsertNodeQuickEditorRegistryEntry: s.upsertNodeQuickEditorRegistryEntry,
      removeNodeQuickEditorRegistryEntry: s.removeNodeQuickEditorRegistryEntry,
      toggleNodeQuickEditorRegistryEntryEnabled: s.toggleNodeQuickEditorRegistryEntryEnabled,
    })),
  )

  const normalizedQuery = normalizeText(searchQuery).trim()
  const [enabledOnly, setEnabledOnly] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [drawer, setDrawer] = React.useState<{
    mode: 'create' | 'edit'
    id: string | null
    initialDraft?: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> | null
  } | null>(null)

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

  const selectedNode = React.useMemo(() => {
    const nodeId = String(selectedNodeId || '').trim()
    if (!nodeId) return null
    const cur = graphData
    if (!cur) return null
    return (cur.nodes || []).find(n => n && n.id === nodeId) || null
  }, [graphData, selectedNodeId])

  const resolvedFromSelection = React.useMemo(
    () => resolveNodeQuickEditorRegistryEntry({ node: selectedNode, registry: nodeQuickEditorRegistry }),
    [nodeQuickEditorRegistry, selectedNode],
  )

  React.useEffect(() => {
    if (!selectedId) return
    if (selected) return
    setSelectedId(null)
  }, [selected, selectedId])

  React.useEffect(() => {
    const nextId = resolvedFromSelection?.id || null
    if (selectedId === nextId) return
    setSelectedId(nextId)
  }, [resolvedFromSelection, selectedId])

  const openCreate = React.useCallback(() => {
    setDrawer({ mode: 'create', id: null })
  }, [])

  const openEdit = React.useCallback((id: string) => {
    const cleanId = String(id || '').trim()
    if (!cleanId) return
    setDrawer({ mode: 'edit', id: cleanId })
  }, [])

  const closeDrawer = React.useCallback(() => setDrawer(null), [])

  const openCreateFromNodeQuickEditor = React.useCallback(() => {
    const cur = graphData
    const nodeId = String(selectedNodeId || '').trim()
    if (!cur || !nodeId) {
      upsertUiToast({ id: 'flow-editor-manager-no-selected-node', kind: 'warning', message: 'Select a node first.', ttlMs: 2500 })
      return
    }
    const node = (cur.nodes || []).find(n => n && n.id === nodeId) || null
    const nodeTypeId = String(node?.type || '').trim()
    if (!nodeTypeId) {
      upsertUiToast({ id: 'flow-editor-manager-selected-node-missing-type', kind: 'warning', message: 'Selected node has no type.', ttlMs: 2500 })
      return
    }
    const props = (node?.properties || {}) as Record<string, unknown>
    const model = typeof props.model === 'string' ? props.model.trim() : ''
    const inferredDraft =
      model === 'generate_video'
        ? { ...buildGenerateVideoRegistryDraft(), nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID }
        : buildNodeQuickEditorDraftFromSmartFields({ nodeTypeId })
    setDrawer({ mode: 'create', id: null, initialDraft: inferredDraft })
  }, [graphData, selectedNodeId, upsertUiToast])

  const registerGenerateVideoFromSelection = React.useCallback(() => {
    const cur = graphData
    const nodeId = String(selectedNodeId || '').trim()
    if (!cur || !nodeId) {
      upsertUiToast({ id: 'flow-editor-manager-no-selected-node-gv', kind: 'warning', message: 'Select a node first.', ttlMs: 2500 })
      return
    }
    const node = (cur.nodes || []).find(n => n && n.id === nodeId) || null
    if (!node) return

    const currentType = String(node.type || '').trim()
    const currentLabel = String(node.label || '').trim()
    const nextProps = (node.properties || {}) as Record<string, unknown>
    const nextModel = typeof nextProps.model === 'string' ? nextProps.model.trim() : ''

    const nextType = FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    const nextLabel = FLOW_VIDEO_GENERATION_NODE_LABEL
    const updates: Record<string, unknown> = {}
    if (currentType !== nextType) updates.type = nextType
    if (!currentLabel || currentLabel === currentType) updates.label = nextLabel
    if (nextModel !== 'generate_video') updates.properties = { ...(node.properties || {}), model: 'generate_video' }
    if (Object.keys(updates).length > 0) updateNode(nodeId, updates as never)

    const res = upsertNodeQuickEditorRegistryEntry({
      isEnabled: true,
      nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      quickEditorTypeId: 'default',
      formId: 'videoGeneration',
      fields: buildGenerateVideoRegistryDraft().fields,
      ports: buildGenerateVideoRegistryDraft().ports,
      schemaMappings: [],
    })
    if (res.ok !== true) {
      upsertUiToast({
        id: 'flow-editor-manager-register-gv-failed',
        kind: 'warning',
        message: 'message' in res ? String(res.message || '').trim() : 'Register failed.',
        ttlMs: 4000,
      })
      return
    }
    setSelectedId(res.id)
    upsertUiToast({ id: 'flow-editor-manager-register-gv-ok', kind: 'neutral', message: 'Registered Generate Video mapping.', ttlMs: 2500 })
  }, [graphData, selectedNodeId, updateNode, upsertNodeQuickEditorRegistryEntry, upsertUiToast])

  const importRegistryFromJson = React.useCallback(async () => {
    const files = await pickFilesWithExtensions(['json'], false)
    const file = files && files[0] ? files[0] : null
    if (!file) return
    let json: unknown = null
    try {
      json = JSON.parse(await file.text())
    } catch {
      return
    }
    const parsed = tryParseQuickEditorImportGraphData(json)
    const meta = parsed?.graphData?.metadata
    const rawRegistry = isRecord(meta) ? meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY] : null
    if (!Array.isArray(rawRegistry) || rawRegistry.length === 0) return
    const imported = rawRegistry
      .map(item => validateNodeQuickEditorRegistryEntry(item))
      .filter((e): e is NodeQuickEditorRegistryEntry => !!e)
    if (imported.length === 0) return
    const merged = normalizeNodeQuickEditorRegistryEntries([...(nodeQuickEditorRegistry || []), ...imported])
    setNodeQuickEditorRegistry(merged)
  }, [nodeQuickEditorRegistry, setNodeQuickEditorRegistry])

  const exportRegistryAsJson = React.useCallback(() => {
    const selectedEntry = selected
    const entries = selectedEntry ? [selectedEntry] : (nodeQuickEditorRegistry || [])
    if (!entries || entries.length === 0) return
    const bundle = buildNodeQuickEditorBundleV1({ registryEntries: entries, graphData: null })
    const blob = nodeQuickEditorBundleToJsonBlob(bundle)
    const filename = selectedEntry ? `node-quick-editor-${selectedEntry.nodeTypeId}.json` : 'node-quick-editor-registry.json'
    downloadBlob(blob, filename)
  }, [nodeQuickEditorRegistry, selected])

  const saveEntry = React.useCallback((next: NodeQuickEditorRegistryEntry) => {
    const res = upsertNodeQuickEditorRegistryEntry({
      id: next.id,
      isEnabled: next.isEnabled,
      nodeTypeId: next.nodeTypeId,
      quickEditorTypeId: next.quickEditorTypeId,
      formId: next.formId,
      fields: next.fields,
      ports: next.ports,
      ...(Array.isArray(next.schemaMappings) ? { schemaMappings: next.schemaMappings } : {}),
    })
    if (res.ok !== true) {
      upsertUiToast({ id: 'flow-editor-manager-save-mapping-failed', kind: 'warning', message: 'message' in res ? String(res.message || '').trim() : 'Save failed.', ttlMs: 4000 })
      return
    }
    setSelectedId(res.id)
    upsertUiToast({ id: 'flow-editor-manager-save-mapping-ok', kind: 'neutral', message: 'Saved mapping.', ttlMs: 2000 })
  }, [upsertNodeQuickEditorRegistryEntry, upsertUiToast])

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

  const handleDelete = React.useCallback((id: string) => {
    const cleanId = String(id || '').trim()
    if (!cleanId) return
    removeNodeQuickEditorRegistryEntry(cleanId)
    setSelectedId(prev => (prev === cleanId ? null : prev))
    setDrawer(null)
  }, [removeNodeQuickEditorRegistryEntry])

  return (
    <section className="h-full min-h-0 flex flex-col" aria-label="Flow Editor Mapping">
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Mapping actions">
          <label className={`inline-flex items-center gap-2 ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
            <input type="checkbox" checked={enabledOnly} onChange={e => setEnabledOnly(e.target.checked)} />
            Enabled only
          </label>
          <menu className="m-0 p-0 list-none flex flex-wrap items-center gap-1" aria-label="Mapping toolbar">
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={importRegistryFromJson} title={UI_COPY.flowEditorManagerImportRegistryTooltip}>
                {UI_LABELS.import}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={exportRegistryAsJson} title={selected ? UI_COPY.flowEditorManagerExportRegistryTooltip : UI_COPY.flowEditorManagerExportRegistrySelectToExportTooltip}>
                {UI_LABELS.export}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={openCreateFromNodeQuickEditor} title={UI_COPY.flowEditorManagerAddFromQuickEditorTooltip}>
                {UI_LABELS.addFromQuickEditor}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={registerGenerateVideoFromSelection} title={UI_COPY.flowEditorManagerRegisterGenerateVideoTooltip}>
                {UI_LABELS.registerGenerateVideo}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={openCreate}>
                {UI_LABELS.add} mapping
              </button>
            </li>
          </menu>
        </nav>
      </header>

      <section className="flex-1 min-h-0 overflow-hidden" aria-label="Mapping content">
        <section className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_520px]" aria-label="Mapping layout">
          <section className="min-h-0 overflow-hidden" aria-label="Mapping list">
            <NodeQuickEditorRegistryTable
              entries={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onEdit={openEdit}
              onToggleEnabled={toggleNodeQuickEditorRegistryEntryEnabled}
              emptyLabel={emptyLabel}
            />
          </section>
          <aside className={`hidden xl:block min-h-0 border-l ${UI_THEME_TOKENS.panel.border} overflow-hidden`} aria-label="Edit mapping panel">
            <section className="h-full min-h-0 p-3">
              {selected ? (
                <FlowMappingRowsEditor entry={selected} onSaveEntry={saveEntry} />
              ) : (
                <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>Select a mapping to edit.</p>
              )}
            </section>
          </aside>
        </section>
      </section>

      <NodeQuickEditorRegistryDrawer
        open={!!drawer}
        mode={drawer?.mode || 'create'}
        entryId={drawer?.id || null}
        entries={nodeQuickEditorRegistry}
        initialDraft={drawer?.mode === 'create' ? drawer?.initialDraft || null : null}
        onClose={closeDrawer}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </section>
  )
}
