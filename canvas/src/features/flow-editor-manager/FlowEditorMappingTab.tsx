import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
} from '@/lib/chatEndpoint'
import {
  FLOW_IMAGE_GENERATION_NODE_LABEL,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_WIDGET_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { pickFilesWithExtensions } from '@/lib/graph/filePicker'
import { downloadBlob } from '@/lib/graph/save'
import { buildWidgetBundleV1, widgetBundleToJsonBlob } from '@/lib/graph/io/widgetBundle'
import { normalizeWidgetRegistryEntries, validateWidgetRegistryEntry } from '@/hooks/store/flowEditorManagerSlice'
import { tryParseWidgetImportGraphData } from '@/lib/graph/io/widgetImport'
import { createUniqueId } from '@/lib/ids'
import {
  buildGenerateImageRegistryDraft,
  buildGenerateVideoRegistryDraft,
  buildTextGenerationRegistryDraft,
  buildWidgetDraftFromSmartFields,
  inferTextGenerationProviderFamily,
} from '@/features/flow-editor-manager/registryTemplates'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY, resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { applyMappingRowsToRegistryEntry, buildMappingRowsFromRegistryEntry, validateMappingRows, type FlowEditorMappingRow } from '@/features/flow-editor-manager/mappingRows'
import { patchById } from 'grph-shared/array/patchArrayItem'
import { FlowEditorMappingTabLayout } from '@/features/flow-editor-manager/FlowEditorMappingTabLayout'
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function inferSmartMediaMode(args: {
  nodeTypeId?: unknown
  formId?: unknown
}): 'image' | 'video' | null {
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) return 'image'
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return 'video'
  const formId = String(args.formId || '').trim()
  if (formId === 'imageGeneration') return 'image'
  if (formId === 'videoGeneration') return 'video'
  return null
}

function getDefaultSmartMediaModel(mode: 'image' | 'video'): string {
  return mode === 'image' ? CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT : CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT
}

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
    widgetRegistry,
    setWidgetRegistry,
    graphData,
    selectedNodeId,
    updateNode,
    upsertUiToast,
    upsertWidgetRegistryEntry,
    removeWidgetRegistryEntry,
    toggleWidgetRegistryEntryEnabled,
  } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      widgetRegistry: s.widgetRegistry,
      setWidgetRegistry: s.setWidgetRegistry,
      graphData: s.graphData,
      selectedNodeId: s.selectedNodeId,
      updateNode: s.updateNode,
      upsertUiToast: s.upsertUiToast,
      upsertWidgetRegistryEntry: s.upsertWidgetRegistryEntry,
      removeWidgetRegistryEntry: s.removeWidgetRegistryEntry,
      toggleWidgetRegistryEntryEnabled: s.toggleWidgetRegistryEntryEnabled,
    })),
  )

  const normalizedQuery = normalizeText(searchQuery).trim()
  const [enabledOnly, setEnabledOnly] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [selectionMode, setSelectionMode] = React.useState<'auto' | 'manual'>('auto')
  const [editorMode, setEditorMode] = React.useState<'none' | 'create' | 'edit'>('none')
  const [editorDraft, setEditorDraft] = React.useState<Omit<WidgetRegistryEntry, 'updatedAt'>>(() => ({
    id: '',
    isEnabled: true,
    nodeTypeId: '',
    widgetTypeId: 'default',
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
      widgetTypeId: 'default',
      formId: 'default',
      fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
      ports: [],
      schemaMappings: [],
      updatedAt: new Date().toISOString(),
    }),
  )
  const [editorError, setEditorError] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const src = Array.isArray(widgetRegistry) ? widgetRegistry : []
    const enabledFiltered = enabledOnly ? src.filter(e => e.isEnabled) : src
    if (!normalizedQuery) return enabledFiltered
    return enabledFiltered.filter(e =>
      normalizeText([e.nodeTypeId, e.widgetTypeId, e.formId, e.id].join(' ')).includes(normalizedQuery),
    )
  }, [enabledOnly, widgetRegistry, normalizedQuery])

  const emptyLabel = React.useMemo(() => {
    if (!normalizedQuery && !enabledOnly) return 'No mappings yet.'
    return 'No mappings match.'
  }, [enabledOnly, normalizedQuery])

  const selected = React.useMemo(() => {
    const id = String(selectedId || '').trim()
    if (!id) return null
    return (widgetRegistry || []).find(e => e.id === id) || null
  }, [widgetRegistry, selectedId])

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
    const nextDraft: Omit<WidgetRegistryEntry, 'updatedAt'> = {
      id: selected.id,
      isEnabled: selected.isEnabled,
      nodeTypeId: selected.nodeTypeId,
      widgetTypeId: selected.widgetTypeId,
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
    () => resolveWidgetRegistryEntry({ node: selectedNode, registry: widgetRegistry }),
    [widgetRegistry, selectedNode],
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

  const openCreate = React.useCallback((initialDraft?: Omit<WidgetRegistryEntry, 'updatedAt'> | null) => {
    setEditorError(null)
    setSelectionMode('manual')
    setSelectedId(null)
    setEditorMode('create')
    const nextDraft: Omit<WidgetRegistryEntry, 'updatedAt'> = initialDraft
      ? {
          id: String(initialDraft.id || '').trim(),
          isEnabled: !!initialDraft.isEnabled,
          nodeTypeId: String(initialDraft.nodeTypeId || '').trim(),
          widgetTypeId: String(initialDraft.widgetTypeId || '').trim() || 'default',
          formId: String(initialDraft.formId || '').trim() || 'default',
          fields: Array.isArray(initialDraft.fields) ? initialDraft.fields : [],
          ports: Array.isArray(initialDraft.ports) ? initialDraft.ports : [],
          schemaMappings: Array.isArray(initialDraft.schemaMappings) ? initialDraft.schemaMappings : [],
        }
      : {
          id: '',
          isEnabled: true,
          nodeTypeId: '',
          widgetTypeId: 'default',
          formId: 'default',
          fields: [{ fieldKey: 'label', fieldType: 'text', schemaPath: 'label' }],
          ports: [],
          schemaMappings: [],
        }
    setEditorDraft(nextDraft)
    setEditorRows(buildMappingRowsFromRegistryEntry({ ...nextDraft, updatedAt: new Date().toISOString() } as WidgetRegistryEntry))
  }, [])

  const openCreateFromWidget = React.useCallback(() => {
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
    const inferredMode = inferSmartMediaMode({
      nodeTypeId,
      formId: props[FLOW_WIDGET_FORM_ID_KEY],
    })
    const inferredDraft =
      inferredMode === 'image'
        ? { ...buildGenerateImageRegistryDraft(), nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID }
        : inferredMode === 'video'
          ? { ...buildGenerateVideoRegistryDraft(), nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID }
        : nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID
          ? buildTextGenerationRegistryDraft({
              providerFamily: inferTextGenerationProviderFamily({
                provider: props.chatProvider,
                widgetTypeId: props[FLOW_WIDGET_TYPE_ID_KEY],
                formId: props[FLOW_WIDGET_FORM_ID_KEY],
              }),
              widgetTypeId: String(props[FLOW_WIDGET_TYPE_ID_KEY] || '').trim() || 'default',
              formId: String(props[FLOW_WIDGET_FORM_ID_KEY] || '').trim() || 'textGeneration',
            })
          : buildWidgetDraftFromSmartFields({ nodeTypeId })
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
    const nextType = FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    const nextLabel = FLOW_VIDEO_GENERATION_NODE_LABEL
    const updates: Record<string, unknown> = {}
    if (currentType !== nextType) updates.type = nextType
    if (!currentLabel || currentLabel === currentType) updates.label = nextLabel
    if (String(nextProps.model || '').trim() !== CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT) {
      updates.properties = { ...(node.properties || {}), model: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT }
    }
    if (Object.keys(updates).length > 0) updateNode(nodeId, updates as never)

    const res = upsertWidgetRegistryEntry({
      isEnabled: true,
      nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
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
  }, [graphData, selectedNodeId, updateNode, upsertWidgetRegistryEntry, upsertUiToast])

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
    const inferredMode = inferSmartMediaMode({
      nodeTypeId: baseType,
      formId: props[FLOW_WIDGET_FORM_ID_KEY],
    })
    const draft = inferredMode === 'image'
      ? buildGenerateImageRegistryDraft()
      : inferredMode === 'video'
        ? buildGenerateVideoRegistryDraft()
        : baseType === FLOW_TEXT_GENERATION_NODE_TYPE_ID
          ? buildTextGenerationRegistryDraft({
              providerFamily: inferTextGenerationProviderFamily({
                provider: props.chatProvider,
                widgetTypeId: props[FLOW_WIDGET_TYPE_ID_KEY],
                formId: props[FLOW_WIDGET_FORM_ID_KEY],
              }),
              widgetTypeId: String(props[FLOW_WIDGET_TYPE_ID_KEY] || '').trim() || 'default',
              formId: String(props[FLOW_WIDGET_FORM_ID_KEY] || '').trim() || 'textGeneration',
            })
        : buildWidgetDraftFromSmartFields({ nodeTypeId: baseType })

    const res = upsertWidgetRegistryEntry({
      isEnabled: true,
      nodeTypeId: draft.nodeTypeId,
      widgetTypeId: draft.widgetTypeId,
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
      const nextLabel = draft.nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
        ? FLOW_IMAGE_GENERATION_NODE_LABEL
        : draft.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
          ? FLOW_VIDEO_GENERATION_NODE_LABEL
          : draft.nodeTypeId
      updates.label = nextLabel
    }
    const nextProps: Record<string, unknown> = {
      ...(node.properties || {}),
      [FLOW_WIDGET_TYPE_ID_KEY]: draft.widgetTypeId,
      [FLOW_WIDGET_FORM_ID_KEY]: draft.formId,
    }
    const smartMediaMode = inferSmartMediaMode({
      nodeTypeId: draft.nodeTypeId,
      formId: draft.formId,
    })
    if (smartMediaMode) {
      const expectedModel = getDefaultSmartMediaModel(smartMediaMode)
      if (String(nextProps.model || '').trim() !== expectedModel) nextProps.model = expectedModel
    }
    updates.properties = nextProps
    updateNode(nodeId, updates as never)

    setSelectedId(res.id)
    setSelectionMode('manual')
    upsertUiToast({ id: 'flow-editor-manager-register-selected-type-ok', kind: 'neutral', message: 'Registered mapping.', ttlMs: 2200 })
  }, [graphData, selectedNodeId, updateNode, upsertWidgetRegistryEntry, upsertUiToast])

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

    if (entry.isEnabled !== true) toggleWidgetRegistryEntryEnabled(entry.id, true)

    const updates: Record<string, unknown> = {}
    if (String(node.type || '').trim() !== entry.nodeTypeId) updates.type = entry.nodeTypeId
    const nextProps: Record<string, unknown> = {
      ...(node.properties || {}),
      [FLOW_WIDGET_TYPE_ID_KEY]: entry.widgetTypeId,
      [FLOW_WIDGET_FORM_ID_KEY]: entry.formId,
    }
    updates.properties = nextProps
    updateNode(nodeId, updates as never)

    upsertUiToast({ id: 'flow-editor-manager-apply-ok', kind: 'neutral', message: 'Applied mapping to node.', ttlMs: 2200 })
  }, [graphData, selected, selectedNodeId, toggleWidgetRegistryEntryEnabled, updateNode, upsertUiToast])

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
    const parsed = tryParseWidgetImportGraphData(json)
    const meta = parsed?.graphData?.metadata
    const rawRegistry = isRecord(meta) ? meta[FLOW_WIDGET_REGISTRY_METADATA_KEY] : null
    if (!Array.isArray(rawRegistry) || rawRegistry.length === 0) return
    const imported = rawRegistry
      .map(item => validateWidgetRegistryEntry(item))
      .filter((e): e is WidgetRegistryEntry => !!e)
    if (imported.length === 0) return
    const merged = normalizeWidgetRegistryEntries([...(widgetRegistry || []), ...imported])
    setWidgetRegistry(merged)
  }, [widgetRegistry, setWidgetRegistry])

  const exportRegistryAsJson = React.useCallback(() => {
    const selectedEntry = selected
    const entries = selectedEntry ? [selectedEntry] : (widgetRegistry || [])
    if (!entries || entries.length === 0) return
    const bundle = buildWidgetBundleV1({ registryEntries: entries, graphData: null })
    const blob = widgetBundleToJsonBlob(bundle)
    const filename = selectedEntry ? `widget-${selectedEntry.nodeTypeId}.json` : 'widget-registry.json'
    downloadBlob(blob, filename)
  }, [widgetRegistry, selected])



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
      const nextDraft: Omit<WidgetRegistryEntry, 'updatedAt'> = {
        id: selected.id,
        isEnabled: selected.isEnabled,
        nodeTypeId: selected.nodeTypeId,
        widgetTypeId: selected.widgetTypeId,
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
    const widgetTypeId = String(editorDraft.widgetTypeId || '').trim()
    const formId = String(editorDraft.formId || '').trim()
    if (!nodeTypeId) return 'Node Type is required.'
    if (!widgetTypeId) return 'Widget Type is required.'
    if (!formId) return 'Form ID is required.'
    return validateMappingRows(editorRows)
  }, [editorDraft.formId, editorDraft.nodeTypeId, editorDraft.widgetTypeId, editorRows])

  const saveEditor = React.useCallback(() => {
    if (editorMode === 'none') return
    const localErr = validateEditor()
    if (localErr) {
      setEditorError(localErr)
      return
    }
    setEditorError(null)
    const baseEntry = { ...editorDraft, updatedAt: new Date().toISOString() } as WidgetRegistryEntry
    const nextEntry = applyMappingRowsToRegistryEntry({ entry: baseEntry, rows: editorRows })

    const res = upsertWidgetRegistryEntry({
      ...(editorMode === 'edit' ? { id: String(editorDraft.id || '').trim() || undefined } : { id: String(editorDraft.id || '').trim() || undefined }),
      isEnabled: !!editorDraft.isEnabled,
      nodeTypeId: String(editorDraft.nodeTypeId || '').trim(),
      widgetTypeId: String(editorDraft.widgetTypeId || '').trim(),
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
  }, [editorDraft, editorMode, editorRows, upsertWidgetRegistryEntry, validateEditor])

  const deleteEditor = React.useCallback(() => {
    if (editorMode !== 'edit') return
    const id = String(editorDraft.id || '').trim()
    if (!id) return
    removeWidgetRegistryEntry(id)
    closeEditor()
  }, [closeEditor, editorDraft.id, editorMode, removeWidgetRegistryEntry])

  const isDirty = React.useMemo(() => {
    if (editorMode === 'none') return false
    if (editorMode === 'create') return true
    if (!selected) return true

    const currentBase = { ...editorDraft, updatedAt: selected.updatedAt } as WidgetRegistryEntry
    const current = applyMappingRowsToRegistryEntry({ entry: currentBase, rows: editorRows })

    const comparableCurrent = {
      isEnabled: !!current.isEnabled,
      nodeTypeId: String(current.nodeTypeId || '').trim(),
      widgetTypeId: String(current.widgetTypeId || '').trim(),
      formId: String(current.formId || '').trim(),
      fields: Array.isArray(current.fields) ? current.fields : [],
      ports: Array.isArray(current.ports) ? current.ports : [],
    }
    const comparableSelected = {
      isEnabled: !!selected.isEnabled,
      nodeTypeId: String(selected.nodeTypeId || '').trim(),
      widgetTypeId: String(selected.widgetTypeId || '').trim(),
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
      openCreateFromWidget={openCreateFromWidget}
      registerSelectedNodeTypeFromSelection={registerSelectedNodeTypeFromSelection}
      registerGenerateVideoFromSelection={registerGenerateVideoFromSelection}
      applySelectedMappingToSelectedNode={applySelectedMappingToSelectedNode}
      openCreate={() => openCreate(null)}
      filtered={filtered}
      selectedId={selectedId}
      handleSelect={handleSelect}
      toggleWidgetRegistryEntryEnabled={toggleWidgetRegistryEntryEnabled}
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
