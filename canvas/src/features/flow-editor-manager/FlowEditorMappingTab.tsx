import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY, FLOW_VIDEO_GENERATION_NODE_LABEL, FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { pickFilesWithExtensions } from '@/lib/graph/filePicker'
import { downloadBlob } from '@/lib/graph/save'
import { buildNodeQuickEditorBundleV1, nodeQuickEditorBundleToJsonBlob } from '@/lib/graph/io/nodeQuickEditorBundle'
import { normalizeNodeQuickEditorRegistryEntries, validateNodeQuickEditorRegistryEntry } from '@/hooks/store/flowEditorManagerSlice'
import { tryParseQuickEditorImportGraphData } from '@/lib/graph/io/quickEditorImport'
import { createUniqueId } from '@/lib/ids'
import { buildGenerateVideoRegistryDraft, buildNodeQuickEditorDraftFromSmartFields } from '@/features/flow-editor-manager/registryTemplates'
import { FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY, FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY, resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { applyMappingRowsToRegistryEntry, buildMappingRowsFromRegistryEntry, validateMappingRows, type FlowEditorMappingRow } from '@/features/flow-editor-manager/mappingRows'
import { patchById } from 'grph-shared/array/patchArrayItem'
import { FlowEditorMappingTabLayout } from '@/features/flow-editor-manager/FlowEditorMappingTabLayout'
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export default function FlowEditorMappingTab({ searchQuery, onRegisterActions }: {
  searchQuery: string
  onRegisterActions?: (actions: {
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }) => void
}) {
  const panelTypography = usePanelTypography()
  const {
    uiIconScale,
    uiIconStrokeWidth,
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
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
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
  const [selectionMode, setSelectionMode] = React.useState<'auto' | 'manual'>('auto')
  const [editorMode, setEditorMode] = React.useState<'none' | 'create' | 'edit'>('none')
  const [editorDraft, setEditorDraft] = React.useState<Omit<NodeQuickEditorRegistryEntry, 'updatedAt'>>(() => ({
    id: '',
    isEnabled: true,
    nodeTypeId: '',
    quickEditorTypeId: 'default',
    formId: 'default',
    fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
    ports: [],
    schemaMappings: [],
  }))
  const [editorRows, setEditorRows] = React.useState<FlowEditorMappingRow[]>(() =>
    buildMappingRowsFromRegistryEntry({
      id: '',
      isEnabled: true,
      nodeTypeId: '',
      quickEditorTypeId: 'default',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
      ports: [],
      schemaMappings: [],
      updatedAt: new Date().toISOString(),
    }),
  )
  const [editorError, setEditorError] = React.useState<string | null>(null)

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

  const lastAppliedSelectionKeyRef = React.useRef<string>('')

  React.useEffect(() => {
    const id = String(selectedId || '').trim()
    if (!id || !selected) {
      lastAppliedSelectionKeyRef.current = ''
      if (editorMode === 'edit') setEditorMode('none')
      return
    }

    const selKey = `${selected.id}|${String(selected.updatedAt || '')}`
    if (lastAppliedSelectionKeyRef.current === selKey) {
      if (editorMode !== 'edit') setEditorMode('edit')
      return
    }
    lastAppliedSelectionKeyRef.current = selKey

    setEditorError(prev => (prev === null ? prev : null))
    if (editorMode !== 'edit') setEditorMode('edit')
    const nextDraft: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> = {
      id: selected.id,
      isEnabled: selected.isEnabled,
      nodeTypeId: selected.nodeTypeId,
      quickEditorTypeId: selected.quickEditorTypeId,
      formId: selected.formId,
      fields: Array.isArray(selected.fields) ? selected.fields : [],
      ports: Array.isArray(selected.ports) ? selected.ports : [],
      schemaMappings: Array.isArray(selected.schemaMappings) ? selected.schemaMappings : [],
    }
    setEditorDraft(nextDraft)
    setEditorRows(buildMappingRowsFromRegistryEntry({ ...nextDraft, updatedAt: selected.updatedAt }))
  }, [editorMode, selected, selectedId])

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
    if (selectionMode !== 'auto') {
      if (selectedId && !selected) setSelectedId(null)
      return
    }
    if (editorMode !== 'none') return
    const nextId = resolvedFromSelection?.id || null
    if (selectedId === nextId) {
      if (selectedId && !selected) setSelectedId(null)
      return
    }
    setSelectedId(nextId)
  }, [editorMode, resolvedFromSelection, selected, selectedId, selectionMode])

  const handleSelect = React.useCallback((id: string | null) => {
    setSelectionMode('manual')
    setSelectedId(id)
  }, [])

  const closeEditor = React.useCallback(() => {
    setEditorError(null)
    setEditorMode('none')
    setSelectionMode('auto')
    setSelectedId(null)
  }, [])

  const openCreate = React.useCallback((initialDraft?: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> | null) => {
    setEditorError(null)
    setSelectionMode('manual')
    setSelectedId(null)
    setEditorMode('create')
    const nextDraft: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> = initialDraft
      ? {
          id: String(initialDraft.id || '').trim(),
          isEnabled: !!initialDraft.isEnabled,
          nodeTypeId: String(initialDraft.nodeTypeId || '').trim(),
          quickEditorTypeId: String(initialDraft.quickEditorTypeId || '').trim() || 'default',
          formId: String(initialDraft.formId || '').trim() || 'default',
          fields: Array.isArray(initialDraft.fields) ? initialDraft.fields : [],
          ports: Array.isArray(initialDraft.ports) ? initialDraft.ports : [],
          schemaMappings: Array.isArray(initialDraft.schemaMappings) ? initialDraft.schemaMappings : [],
        }
      : {
          id: '',
          isEnabled: true,
          nodeTypeId: '',
          quickEditorTypeId: 'default',
          formId: 'default',
          fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
          ports: [],
          schemaMappings: [],
        }
    setEditorDraft(nextDraft)
    setEditorRows(buildMappingRowsFromRegistryEntry({ ...nextDraft, updatedAt: new Date().toISOString() } as NodeQuickEditorRegistryEntry))
  }, [])

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
    openCreate(inferredDraft)
  }, [graphData, openCreate, selectedNodeId, upsertUiToast])

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

  const registerSelectedNodeTypeFromSelection = React.useCallback(() => {
    const cur = graphData
    const nodeId = String(selectedNodeId || '').trim()
    if (!cur || !nodeId) {
      upsertUiToast({ id: 'flow-editor-manager-no-selected-node-register', kind: 'warning', message: 'Select a node first.', ttlMs: 2500 })
      return
    }
    const node = (cur.nodes || []).find(n => n && n.id === nodeId) || null
    if (!node) return
    const baseType = String(node.type || '').trim()
    if (!baseType) {
      upsertUiToast({ id: 'flow-editor-manager-selected-node-missing-type-register', kind: 'warning', message: 'Selected node has no type.', ttlMs: 2500 })
      return
    }

    const props = (node.properties || {}) as Record<string, unknown>
    const model = typeof props.model === 'string' ? props.model.trim() : ''
    const draft = model === 'generate_video'
      ? buildGenerateVideoRegistryDraft()
      : buildNodeQuickEditorDraftFromSmartFields({ nodeTypeId: baseType })

    const res = upsertNodeQuickEditorRegistryEntry({
      isEnabled: true,
      nodeTypeId: draft.nodeTypeId,
      quickEditorTypeId: draft.quickEditorTypeId,
      formId: draft.formId,
      fields: draft.fields,
      ports: draft.ports,
      schemaMappings: Array.isArray(draft.schemaMappings) ? draft.schemaMappings : [],
    })
    if (res.ok !== true) {
      upsertUiToast({
        id: 'flow-editor-manager-register-selected-type-failed',
        kind: 'warning',
        message: 'message' in res ? String(res.message || '').trim() : 'Register failed.',
        ttlMs: 4000,
      })
      return
    }

    const updates: Record<string, unknown> = {}
    if (String(node.type || '').trim() !== draft.nodeTypeId) updates.type = draft.nodeTypeId
    const label = String(node.label || '').trim()
    if (!label || label === String(node.type || '').trim()) {
      const nextLabel = draft.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID ? FLOW_VIDEO_GENERATION_NODE_LABEL : draft.nodeTypeId
      updates.label = nextLabel
    }
    const nextProps: Record<string, unknown> = {
      ...(node.properties || {}),
      [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: draft.quickEditorTypeId,
      [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: draft.formId,
    }
    if (draft.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
      if (typeof nextProps.model !== 'string' || String(nextProps.model).trim() !== 'generate_video') nextProps.model = 'generate_video'
    }
    updates.properties = nextProps
    updateNode(nodeId, updates as never)

    setSelectedId(res.id)
    setSelectionMode('manual')
    upsertUiToast({ id: 'flow-editor-manager-register-selected-type-ok', kind: 'neutral', message: 'Registered mapping.', ttlMs: 2200 })
  }, [graphData, selectedNodeId, updateNode, upsertNodeQuickEditorRegistryEntry, upsertUiToast])

  const applySelectedMappingToSelectedNode = React.useCallback(() => {
    const entry = selected
    const cur = graphData
    const nodeId = String(selectedNodeId || '').trim()
    if (!entry) {
      upsertUiToast({ id: 'flow-editor-manager-apply-no-selected-entry', kind: 'warning', message: 'Select a mapping first.', ttlMs: 2500 })
      return
    }
    if (!cur || !nodeId) {
      upsertUiToast({ id: 'flow-editor-manager-apply-no-selected-node', kind: 'warning', message: 'Select a node first.', ttlMs: 2500 })
      return
    }
    const node = (cur.nodes || []).find(n => n && n.id === nodeId) || null
    if (!node) return

    if (entry.isEnabled !== true) toggleNodeQuickEditorRegistryEntryEnabled(entry.id, true)

    const updates: Record<string, unknown> = {}
    if (String(node.type || '').trim() !== entry.nodeTypeId) updates.type = entry.nodeTypeId
    const nextProps: Record<string, unknown> = {
      ...(node.properties || {}),
      [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: entry.quickEditorTypeId,
      [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: entry.formId,
    }
    updates.properties = nextProps
    updateNode(nodeId, updates as never)

    upsertUiToast({ id: 'flow-editor-manager-apply-ok', kind: 'neutral', message: 'Applied mapping to node.', ttlMs: 2200 })
  }, [graphData, selected, selectedNodeId, toggleNodeQuickEditorRegistryEntryEnabled, updateNode, upsertUiToast])

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



  const addEditorRow = React.useCallback(() => {
    setEditorRows(prev => {
      const used = new Set(prev.map(r => r.id))
      const id = createUniqueId('qerRow', used)
      return [...prev, { id, key: '', type: 'text', value: '', required: false, direction: 'default' }]
    })
  }, [])

  const updateEditorRow = React.useCallback((id: string, patch: Partial<FlowEditorMappingRow>) => {
    const target = String(id || '').trim()
    if (!target) return
    setEditorRows(prev => patchById(prev, target, r => r.id, r => ({ ...r, ...patch })))
  }, [])

  const deleteEditorRow = React.useCallback((id: string) => {
    const target = String(id || '').trim()
    if (!target) return
    setEditorRows(prev => prev.filter(r => r.id !== target))
  }, [])

  const reorderEditorRow = React.useCallback((fromId: string, toId: string) => {
    const from = String(fromId || '').trim()
    const to = String(toId || '').trim()
    if (!from || !to || from === to) return
    setEditorRows(prev => {
      const fromIndex = prev.findIndex(r => r.id === from)
      const toIndex = prev.findIndex(r => r.id === to)
      if (fromIndex < 0 || toIndex < 0) return prev
      if (fromIndex === toIndex) return prev
      const next = prev.slice()
      const [moved] = next.splice(fromIndex, 1)
      const insertIndex = fromIndex < toIndex ? Math.max(0, toIndex - 1) : toIndex
      next.splice(insertIndex, 0, moved)
      return next
    })
  }, [])

  const resetEditor = React.useCallback(() => {
    setEditorError(null)
    if (editorMode === 'edit' && selected) {
      const nextDraft: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'> = {
        id: selected.id,
        isEnabled: selected.isEnabled,
        nodeTypeId: selected.nodeTypeId,
        quickEditorTypeId: selected.quickEditorTypeId,
        formId: selected.formId,
        fields: Array.isArray(selected.fields) ? selected.fields : [],
        ports: Array.isArray(selected.ports) ? selected.ports : [],
        schemaMappings: Array.isArray(selected.schemaMappings) ? selected.schemaMappings : [],
      }
      setEditorDraft(nextDraft)
      setEditorRows(buildMappingRowsFromRegistryEntry({ ...nextDraft, updatedAt: selected.updatedAt }))
      return
    }
    openCreate(null)
  }, [editorMode, openCreate, selected])

  const validateEditor = React.useCallback((): string | null => {
    const nodeTypeId = String(editorDraft.nodeTypeId || '').trim()
    const quickEditorTypeId = String(editorDraft.quickEditorTypeId || '').trim()
    const formId = String(editorDraft.formId || '').trim()
    if (!nodeTypeId) return 'Node Type is required.'
    if (!quickEditorTypeId) return 'Quick Editor Type is required.'
    if (!formId) return 'Form ID is required.'
    return validateMappingRows(editorRows)
  }, [editorDraft.formId, editorDraft.nodeTypeId, editorDraft.quickEditorTypeId, editorRows])

  const saveEditor = React.useCallback(() => {
    if (editorMode === 'none') return
    const localErr = validateEditor()
    if (localErr) {
      setEditorError(localErr)
      return
    }
    setEditorError(null)
    const baseEntry = { ...editorDraft, updatedAt: new Date().toISOString() } as NodeQuickEditorRegistryEntry
    const nextEntry = applyMappingRowsToRegistryEntry({ entry: baseEntry, rows: editorRows })

    const res = upsertNodeQuickEditorRegistryEntry({
      ...(editorMode === 'edit' ? { id: String(editorDraft.id || '').trim() || undefined } : { id: String(editorDraft.id || '').trim() || undefined }),
      isEnabled: !!editorDraft.isEnabled,
      nodeTypeId: String(editorDraft.nodeTypeId || '').trim(),
      quickEditorTypeId: String(editorDraft.quickEditorTypeId || '').trim(),
      formId: String(editorDraft.formId || '').trim(),
      fields: nextEntry.fields,
      ports: nextEntry.ports,
      schemaMappings: [],
    })
    if (res.ok !== true) {
      setEditorError('message' in res ? String(res.message || '').trim() : 'Save failed.')
      return
    }
    setSelectedId(res.id)
    setEditorMode('edit')
  }, [editorDraft, editorMode, editorRows, upsertNodeQuickEditorRegistryEntry, validateEditor])

  const deleteEditor = React.useCallback(() => {
    if (editorMode !== 'edit') return
    const id = String(editorDraft.id || '').trim()
    if (!id) return
    removeNodeQuickEditorRegistryEntry(id)
    closeEditor()
  }, [closeEditor, editorDraft.id, editorMode, removeNodeQuickEditorRegistryEntry])

  const isDirty = React.useMemo(() => {
    if (editorMode === 'none') return false
    if (editorMode === 'create') return true
    if (!selected) return true

    const currentBase = { ...editorDraft, updatedAt: selected.updatedAt } as NodeQuickEditorRegistryEntry
    const current = applyMappingRowsToRegistryEntry({ entry: currentBase, rows: editorRows })

    const comparableCurrent = {
      isEnabled: !!current.isEnabled,
      nodeTypeId: String(current.nodeTypeId || '').trim(),
      quickEditorTypeId: String(current.quickEditorTypeId || '').trim(),
      formId: String(current.formId || '').trim(),
      fields: Array.isArray(current.fields) ? current.fields : [],
      ports: Array.isArray(current.ports) ? current.ports : [],
    }
    const comparableSelected = {
      isEnabled: !!selected.isEnabled,
      nodeTypeId: String(selected.nodeTypeId || '').trim(),
      quickEditorTypeId: String(selected.quickEditorTypeId || '').trim(),
      formId: String(selected.formId || '').trim(),
      fields: Array.isArray(selected.fields) ? selected.fields : [],
      ports: Array.isArray(selected.ports) ? selected.ports : [],
    }

    try {
      return JSON.stringify(comparableCurrent) !== JSON.stringify(comparableSelected)
    } catch {
      return true
    }
  }, [editorDraft, editorMode, editorRows, selected])

  const registerActionsSigRef = React.useRef<string>('')
  const registerActionsFnsRef = React.useRef<{ save: () => void; reset: () => void } | null>(null)
  registerActionsFnsRef.current = { save: saveEditor, reset: resetEditor }

  React.useEffect(() => {
    if (!onRegisterActions) return
    const sig = `${editorMode}|${isDirty ? 1 : 0}`
    if (registerActionsSigRef.current === sig) return
    registerActionsSigRef.current = sig

    if (editorMode === 'none') {
      onRegisterActions({ apply: undefined, reset: undefined, applyDisabled: true, resetDisabled: true })
      return
    }
    onRegisterActions({
      apply: () => registerActionsFnsRef.current?.save(),
      reset: () => registerActionsFnsRef.current?.reset(),
      applyDisabled: !isDirty,
      resetDisabled: false,
    })
  }, [editorMode, isDirty, onRegisterActions])

  return (
    <FlowEditorMappingTabLayout
      panelTypographyMicroLabelClass={panelTypography.microLabelClass}
      enabledOnly={enabledOnly}
      setEnabledOnly={setEnabledOnly}
      importRegistryFromJson={importRegistryFromJson}
      exportRegistryAsJson={exportRegistryAsJson}
      selectedExists={!!selected}
      openCreateFromNodeQuickEditor={openCreateFromNodeQuickEditor}
      registerSelectedNodeTypeFromSelection={registerSelectedNodeTypeFromSelection}
      registerGenerateVideoFromSelection={registerGenerateVideoFromSelection}
      applySelectedMappingToSelectedNode={applySelectedMappingToSelectedNode}
      openCreate={() => openCreate(null)}
      filtered={filtered}
      selectedId={selectedId}
      handleSelect={handleSelect}
      toggleNodeQuickEditorRegistryEntryEnabled={toggleNodeQuickEditorRegistryEntryEnabled}
      emptyLabel={emptyLabel}
      editorMode={editorMode}
      editorDraft={editorDraft}
      editorRows={editorRows}
      editorError={editorError}
      uiIconScale={uiIconScale}
      uiIconStrokeWidth={uiIconStrokeWidth}
      closeEditor={closeEditor}
      setEditorDraft={setEditorDraft}
      addEditorRow={addEditorRow}
      resetEditor={resetEditor}
      saveEditor={saveEditor}
      deleteEditor={deleteEditor}
      updateEditorRow={updateEditorRow}
      deleteEditorRow={deleteEditorRow}
      reorderEditorRow={reorderEditorRow}
    />
  )
}
