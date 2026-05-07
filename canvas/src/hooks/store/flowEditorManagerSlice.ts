import type { StoreApi } from 'zustand'

import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsSetJson, getLocalStorage } from '@/lib/persistence'
import { createUniqueId } from '@/lib/ids'
import type { GraphState } from '@/hooks/store/types'
import {
  buildGenerateImageRegistryDraft,
  buildGenerateTextRegistryDraft,
  buildGenerateVideoRegistryDraft,
  buildBytePlusVideoScriptRegistryDraft,
  buildOpenAiVideoScriptRegistryDraft,
  buildRichMediaPanelRegistryDraft,
  buildVideoTranscriberRegistryDraft,
  buildTextGenerationRegistryDraft,
} from '@/features/flow-editor-manager/registryTemplates'
import {
  buildGrabMapsDiscoveryRegistryDraft,
  FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
  FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_OPENAI_VIDEO_SCRIPT_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_FORM_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
  FLOW_VIDEO_SCRIPT_FORM_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  readWidgetRegistryMetadataEntries,
} from '@/lib/config.flow-editor'
import type {
  WidgetRegistryEntry,
  WidgetRegistryField,
  WidgetRegistryPort,
  WidgetRegistrySchemaMapping,
} from '@/features/flow-editor-manager/widgetRegistryTypes'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

const trimOrEmpty = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function validateWidgetRegistryEntry(raw: unknown): WidgetRegistryEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>

  const id = trimOrEmpty(rec.id)
  const nodeTypeId = trimOrEmpty(rec.nodeTypeId)
  const widgetTypeId = trimOrEmpty(rec.widgetTypeId)
  const formId = trimOrEmpty(rec.formId)
  const updatedAt = trimOrEmpty(rec.updatedAt)
  const isEnabled = typeof rec.isEnabled === 'boolean' ? rec.isEnabled : true

  if (!id || !nodeTypeId || !widgetTypeId || !formId) return null

  const fieldsRaw = Array.isArray(rec.fields) ? rec.fields : []
  const portsRaw = Array.isArray(rec.ports) ? rec.ports : []
  const schemaMappingsRaw = Array.isArray(rec.schemaMappings) ? rec.schemaMappings : null

  const fields: WidgetRegistryField[] = []
  const fieldKeySet = new Set<string>()
  for (let i = 0; i < fieldsRaw.length; i += 1) {
    const item = fieldsRaw[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const it = item as Record<string, unknown>
    const fieldKey = trimOrEmpty(it.fieldKey)
    const fieldType = trimOrEmpty(it.fieldType)
    if (!fieldKey || !fieldType) continue
    if (fieldKeySet.has(fieldKey)) continue
    fieldKeySet.add(fieldKey)
    const label = trimOrEmpty(it.label) || undefined
    const schemaPath = trimOrEmpty(it.schemaPath) || undefined
    const required = typeof it.required === 'boolean' ? it.required : undefined
    const isHidden = typeof it.isHidden === 'boolean' ? it.isHidden : undefined
    const options = Array.isArray(it.options)
      ? it.options
          .map(option => {
            if (!option || typeof option !== 'object' || Array.isArray(option)) return null
            const rec = option as Record<string, unknown>
            const rawValue = rec.value
            const value =
              typeof rawValue === 'string' || typeof rawValue === 'number'
                ? rawValue
                : typeof rawValue === 'boolean'
                  ? String(rawValue)
                  : null
            if (value == null || (typeof value === 'string' && !value.trim())) return null
            const label = trimOrEmpty(rec.label) || undefined
            return { value, ...(label ? { label } : {}) }
          })
          .filter((option): option is NonNullable<typeof option> => !!option)
      : undefined
    fields.push({
      fieldKey,
      fieldType,
      ...(label ? { label } : {}),
      ...(schemaPath ? { schemaPath } : {}),
      ...(required != null ? { required } : {}),
      ...(isHidden === true ? { isHidden: true } : {}),
      ...(options && options.length > 0 ? { options } : {}),
    })
  }

  const ports: WidgetRegistryPort[] = []
  const portKeySet = new Set<string>()
  for (let i = 0; i < portsRaw.length; i += 1) {
    const item = portsRaw[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const it = item as Record<string, unknown>
    const portKey = trimOrEmpty(it.portKey)
    const direction = trimOrEmpty(it.direction)
    if (!portKey || (direction !== 'input' && direction !== 'output')) continue
    const uniq = `${direction}:${portKey}`
    if (portKeySet.has(uniq)) continue
    portKeySet.add(uniq)
    const schemaPath = trimOrEmpty(it.schemaPath) || undefined
    const isHidden = typeof it.isHidden === 'boolean' ? it.isHidden : undefined
    ports.push({
      portKey,
      direction: direction as 'input' | 'output',
      ...(schemaPath ? { schemaPath } : {}),
      ...(isHidden === true ? { isHidden: true } : {}),
    })
  }

  const schemaMappings: WidgetRegistrySchemaMapping[] | undefined = (() => {
    if (!schemaMappingsRaw) return undefined
    const out: WidgetRegistrySchemaMapping[] = []
    for (let i = 0; i < schemaMappingsRaw.length; i += 1) {
      const item = schemaMappingsRaw[i]
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const it = item as Record<string, unknown>
      const fromPath = trimOrEmpty(it.fromPath)
      const toPath = trimOrEmpty(it.toPath)
      if (!fromPath || !toPath) continue
      const transformId = trimOrEmpty(it.transformId) || undefined
      const reduceId = trimOrEmpty(it.reduceId) || undefined
      out.push({ fromPath, toPath, ...(transformId ? { transformId } : {}), ...(reduceId ? { reduceId } : {}) })
    }
    return out.length > 0 ? out : undefined
  })()

  if (fields.length === 0 && ports.length === 0) return null

  return {
    id,
    isEnabled,
    nodeTypeId,
    widgetTypeId,
    formId,
    fields,
    ports,
    ...(schemaMappings ? { schemaMappings } : {}),
    updatedAt: updatedAt || new Date().toISOString(),
  }
}

export function readValidatedWidgetRegistryMetadataEntries(metadata: unknown): WidgetRegistryEntry[] {
  return readWidgetRegistryMetadataEntries(metadata)
    .map(item => validateWidgetRegistryEntry(item))
    .filter((entry): entry is WidgetRegistryEntry => !!entry)
}

export function readWidgetRegistryFromStorage(storage: Storage | null): WidgetRegistryEntry[] {
  const parse = (v: unknown): WidgetRegistryEntry[] | null => {
    if (!Array.isArray(v)) return []
    const out: WidgetRegistryEntry[] = []
    const seen = new Set<string>()
    for (let i = 0; i < v.length; i += 1) {
      const entry = validateWidgetRegistryEntry(v[i])
      if (!entry) continue
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      out.push(entry)
    }
    return out
  }

  if (!storage) return []
  try {
    const raw = storage.getItem(LS_KEYS.flowEditorManagerWidgetRegistry)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return parse(parsed) || []
  } catch {
    return []
  }
}

export function writeWidgetRegistryToStorage(storage: Storage | null, entries: WidgetRegistryEntry[]): void {
  if (!storage) return
  try {
    storage.setItem(LS_KEYS.flowEditorManagerWidgetRegistry, JSON.stringify(entries))
  } catch {
    void 0
  }
}

export function normalizeWidgetRegistryEntries(
  entries: WidgetRegistryEntry[],
): WidgetRegistryEntry[] {
  const out: WidgetRegistryEntry[] = []
  const ids = new Set<string>()
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    if (!entry) continue
    const validated = validateWidgetRegistryEntry(entry)
    if (!validated) continue
    if (ids.has(validated.id)) continue
    ids.add(validated.id)
    out.push(validated)
  }

  const rich = out.filter(e => e.nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
  if (rich.length > 1) {
    const canonicalTemplate = buildRichMediaPanelRegistryDraft()
    const preferred = rich.find(
      e => e.widgetTypeId === FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID && e.formId === FLOW_RICH_MEDIA_PANEL_FORM_ID,
    ) || rich[0]!

    const fieldKey = (f: WidgetRegistryField): string => {
      const schemaPath = trimOrEmpty(f.schemaPath)
      if (schemaPath) return schemaPath
      return trimOrEmpty(f.fieldKey)
    }
    const portKey = (p: WidgetRegistryPort): string => {
      const schemaPath = trimOrEmpty(p.schemaPath)
      const key = trimOrEmpty(p.portKey)
      return `${p.direction}:${schemaPath || key}`
    }
    const mappingKey = (m: WidgetRegistrySchemaMapping): string => {
      return `${trimOrEmpty(m.fromPath)}->${trimOrEmpty(m.toPath)}:${trimOrEmpty(m.transformId)}:${trimOrEmpty(m.reduceId)}`
    }

    const fields: WidgetRegistryField[] = []
    const ports: WidgetRegistryPort[] = []
    const schemaMappings: WidgetRegistrySchemaMapping[] = []
    const seenFields = new Set<string>()
    const seenPorts = new Set<string>()
    const seenMappings = new Set<string>()

    const pushField = (f: WidgetRegistryField) => {
      const k = fieldKey(f)
      if (!k || seenFields.has(k)) return
      seenFields.add(k)
      fields.push(f)
    }
    const pushPort = (p: WidgetRegistryPort) => {
      const k = portKey(p)
      if (!k || seenPorts.has(k)) return
      seenPorts.add(k)
      ports.push(p)
    }
    const pushMapping = (m: WidgetRegistrySchemaMapping) => {
      const k = mappingKey(m)
      if (!k || seenMappings.has(k)) return
      seenMappings.add(k)
      schemaMappings.push(m)
    }

    for (const f of canonicalTemplate.fields || []) pushField(f)
    for (const p of canonicalTemplate.ports || []) pushPort(p)
    for (const m of canonicalTemplate.schemaMappings || []) pushMapping(m)

    for (let i = 0; i < rich.length; i += 1) {
      const e = rich[i]!
      for (const f of e.fields || []) pushField(f)
      for (const p of e.ports || []) pushPort(p)
      for (const m of e.schemaMappings || []) pushMapping(m)
    }

    const merged: WidgetRegistryEntry = {
      ...preferred,
      nodeTypeId: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
      widgetTypeId: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
      formId: FLOW_RICH_MEDIA_PANEL_FORM_ID,
      fields,
      ports,
      schemaMappings,
    }
    const validatedMerged = validateWidgetRegistryEntry(merged)
    const kept = validatedMerged || preferred
    const next = out.filter(e => e.nodeTypeId !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
    next.push(kept)
    out.length = 0
    out.push(...next)
  }

  const canonicalizeBuiltInForm = (args: {
    formId: string
    draft: Omit<WidgetRegistryEntry, 'updatedAt'>
  }) => {
    const formId = trimOrEmpty(args.formId)
    if (!formId) return
    const matches = out.filter(e => e.formId === formId)
    if (matches.length === 0) return
    const preferred =
      matches.find(
        e =>
          e.nodeTypeId === args.draft.nodeTypeId
          && e.widgetTypeId === args.draft.widgetTypeId
          && e.formId === formId,
      )
      || matches[0]!
    const canonical: WidgetRegistryEntry = {
      ...preferred,
      nodeTypeId: args.draft.nodeTypeId,
      widgetTypeId: args.draft.widgetTypeId,
      formId,
      fields: Array.isArray(args.draft.fields) ? args.draft.fields : [],
      ports: Array.isArray(args.draft.ports) ? args.draft.ports : [],
      ...(Array.isArray(args.draft.schemaMappings) ? { schemaMappings: args.draft.schemaMappings } : {}),
    }
    const validatedCanonical = validateWidgetRegistryEntry(canonical)
    const kept = validatedCanonical || preferred
    const next = out.filter(e => e.formId !== formId)
    next.push(kept)
    out.length = 0
    out.push(...next)
  }

  const discovery = out.filter(
    e =>
      e.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID
      || e.formId === FLOW_GRABMAPS_DISCOVERY_FORM_ID,
  )
  if (discovery.length > 0) {
    const canonicalTemplate = buildGrabMapsDiscoveryRegistryDraft()
    const preferred =
      discovery.find(
        e =>
          e.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID
          && e.widgetTypeId === FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID
          && e.formId === FLOW_GRABMAPS_DISCOVERY_FORM_ID,
      )
      || discovery[0]!
    const canonical: WidgetRegistryEntry = {
      ...preferred,
      nodeTypeId: FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
      widgetTypeId: FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID,
      formId: FLOW_GRABMAPS_DISCOVERY_FORM_ID,
      fields: canonicalTemplate.fields,
      ports: canonicalTemplate.ports,
      ...(Array.isArray(canonicalTemplate.schemaMappings) ? { schemaMappings: canonicalTemplate.schemaMappings } : {}),
    }
    const validatedCanonical = validateWidgetRegistryEntry(canonical)
    const kept = validatedCanonical || preferred
    const next = out.filter(
      e =>
        e.nodeTypeId !== FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID
        && e.formId !== FLOW_GRABMAPS_DISCOVERY_FORM_ID,
    )
    next.push(kept)
    out.length = 0
    out.push(...next)
  }

  canonicalizeBuiltInForm({
    formId: 'imageGeneration',
    draft: buildGenerateImageRegistryDraft(),
  })
  canonicalizeBuiltInForm({
    formId: 'videoGeneration',
    draft: buildGenerateVideoRegistryDraft(),
  })
  canonicalizeBuiltInForm({
    formId: 'textGeneration',
    draft: buildGenerateTextRegistryDraft(),
  })
  canonicalizeBuiltInForm({
    formId: 'textGeneration.openai',
    draft: buildTextGenerationRegistryDraft({
      providerFamily: 'openai',
      widgetTypeId: 'default',
      formId: 'textGeneration.openai',
    }),
  })
  canonicalizeBuiltInForm({
    formId: 'textGeneration.deerflow',
    draft: buildTextGenerationRegistryDraft({
      providerFamily: 'deerflow',
      widgetTypeId: 'default',
      formId: 'textGeneration.deerflow',
    }),
  })

  canonicalizeBuiltInForm({
    formId: FLOW_VIDEO_TRANSCRIBER_FORM_ID,
    draft: buildVideoTranscriberRegistryDraft(),
  })

  out.sort((a, b) => {
    const t = a.nodeTypeId.localeCompare(b.nodeTypeId)
    if (t !== 0) return t
    const e = a.widgetTypeId.localeCompare(b.widgetTypeId)
    if (e !== 0) return e
    return a.formId.localeCompare(b.formId)
  })
  return out
}

function ensureDefaultRegistryEntry(args: {
  entries: WidgetRegistryEntry[]
  nodeTypeId: string
  formId: string
  draft: Omit<WidgetRegistryEntry, 'updatedAt'>
  nowIso?: string
}): { entries: WidgetRegistryEntry[]; changed: boolean } {
  const prev = Array.isArray(args.entries) ? args.entries : []
  const targetWidgetTypeId = trimOrEmpty(args.draft.widgetTypeId) || 'default'
  const existingIndex = prev.findIndex(e => {
    if (!e) return false
    return e.nodeTypeId === args.nodeTypeId && e.widgetTypeId === targetWidgetTypeId && e.formId === args.formId
  })
  const updatedAt = String(args.nowIso || '').trim() || new Date().toISOString()
  const normalizeComparableEntry = (entry: Pick<WidgetRegistryEntry, 'nodeTypeId' | 'widgetTypeId' | 'formId' | 'fields' | 'ports' | 'schemaMappings'>) =>
    JSON.stringify({
      nodeTypeId: entry.nodeTypeId,
      widgetTypeId: entry.widgetTypeId,
      formId: entry.formId,
      fields: (Array.isArray(entry.fields) ? entry.fields : []).map(field => ({
        fieldKey: String(field?.fieldKey || '').trim(),
        fieldType: String(field?.fieldType || '').trim(),
        label: trimOrEmpty(field?.label) || null,
        schemaPath: trimOrEmpty(field?.schemaPath) || null,
        required: typeof field?.required === 'boolean' ? field.required : null,
        isHidden: field?.isHidden === true ? true : null,
        options: (Array.isArray(field?.options) ? field.options : []).map(option => ({
          value:
            typeof option?.value === 'number'
              ? option.value
              : String(option?.value ?? '').trim(),
          label: trimOrEmpty(option?.label) || null,
        })),
      })),
      ports: (Array.isArray(entry.ports) ? entry.ports : []).map(port => ({
        portKey: String(port?.portKey || '').trim(),
        direction: port?.direction === 'output' ? 'output' : 'input',
        schemaPath: trimOrEmpty(port?.schemaPath) || null,
        isHidden: port?.isHidden === true ? true : null,
      })),
      schemaMappings: (Array.isArray(entry.schemaMappings) ? entry.schemaMappings : []).map(mapping => ({
        fromPath: trimOrEmpty(mapping?.fromPath),
        toPath: trimOrEmpty(mapping?.toPath),
        transformId: trimOrEmpty(mapping?.transformId) || null,
        reduceId: trimOrEmpty(mapping?.reduceId) || null,
      })),
    })
  if (existingIndex >= 0) {
    const existing = prev[existingIndex]
    if (!existing) return { entries: prev, changed: false }
    const canonicalComparable = normalizeComparableEntry({
      nodeTypeId: args.nodeTypeId,
      widgetTypeId: targetWidgetTypeId,
      formId: args.formId,
      fields: Array.isArray(args.draft.fields) ? (args.draft.fields as WidgetRegistryField[]) : [],
      ports: Array.isArray(args.draft.ports) ? (args.draft.ports as WidgetRegistryPort[]) : [],
      schemaMappings: Array.isArray(args.draft.schemaMappings) ? (args.draft.schemaMappings as WidgetRegistrySchemaMapping[]) : [],
    })
    const existingComparable = normalizeComparableEntry(existing)
    if (existingComparable === canonicalComparable) return { entries: prev, changed: false }
    const nextEntry: WidgetRegistryEntry = {
      ...existing,
      nodeTypeId: args.nodeTypeId,
      widgetTypeId: targetWidgetTypeId,
      formId: args.formId,
      fields: Array.isArray(args.draft.fields) ? (args.draft.fields as WidgetRegistryField[]) : [],
      ports: Array.isArray(args.draft.ports) ? (args.draft.ports as WidgetRegistryPort[]) : [],
      ...(Array.isArray(args.draft.schemaMappings) ? { schemaMappings: args.draft.schemaMappings as WidgetRegistrySchemaMapping[] } : {}),
      updatedAt,
    }
    const validated = validateWidgetRegistryEntry(nextEntry)
    if (!validated) return { entries: prev, changed: false }
    const next = normalizeWidgetRegistryEntries(prev.map((entry, index) => (index === existingIndex ? validated : entry)))
    return { entries: next, changed: true }
  }

  const usedIds = new Set(prev.map(e => String(e?.id || '')).filter(Boolean))
  const id = createUniqueId('qer', usedIds)
  const nextEntry: WidgetRegistryEntry = {
    id,
    isEnabled: true,
    nodeTypeId: args.nodeTypeId,
    widgetTypeId: targetWidgetTypeId,
    formId: args.formId,
    fields: Array.isArray(args.draft.fields) ? (args.draft.fields as WidgetRegistryField[]) : [],
    ports: Array.isArray(args.draft.ports) ? (args.draft.ports as WidgetRegistryPort[]) : [],
    ...(Array.isArray(args.draft.schemaMappings) ? { schemaMappings: args.draft.schemaMappings as WidgetRegistrySchemaMapping[] } : {}),
    updatedAt,
  }
  const validated = validateWidgetRegistryEntry(nextEntry)
  if (!validated) return { entries: prev, changed: false }
  const next = normalizeWidgetRegistryEntries([...prev, validated])
  return { entries: next, changed: true }
}

export function ensureDefaultWidgetRegistryEntries(
  entries: WidgetRegistryEntry[],
  nowIso?: string,
): { entries: WidgetRegistryEntry[]; changed: boolean } {
  const seededImage = ensureDefaultRegistryEntry({
    entries,
    nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
    formId: 'imageGeneration',
    draft: buildGenerateImageRegistryDraft(),
    nowIso,
  })
  const seededVideo = ensureDefaultRegistryEntry({
    entries: seededImage.entries,
    nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
    formId: 'videoGeneration',
    draft: buildGenerateVideoRegistryDraft(),
    nowIso,
  })
  const seededText = ensureDefaultRegistryEntry({
    entries: seededVideo.entries,
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    formId: 'textGeneration',
    draft: buildGenerateTextRegistryDraft(),
    nowIso,
  })
  const seededVideoScript = ensureDefaultRegistryEntry({
    entries: seededText.entries,
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    formId: FLOW_VIDEO_SCRIPT_FORM_ID,
    draft: buildBytePlusVideoScriptRegistryDraft(),
    nowIso,
  })
  const seededOpenAiText = ensureDefaultRegistryEntry({
    entries: seededVideoScript.entries,
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    formId: 'textGeneration.openai',
    draft: buildTextGenerationRegistryDraft({
      providerFamily: 'openai',
      widgetTypeId: 'default',
      formId: 'textGeneration.openai',
    }),
    nowIso,
  })
  const seededDeerFlowText = ensureDefaultRegistryEntry({
    entries: seededOpenAiText.entries,
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    formId: 'textGeneration.deerflow',
    draft: buildTextGenerationRegistryDraft({
      providerFamily: 'deerflow',
      widgetTypeId: 'default',
      formId: 'textGeneration.deerflow',
    }),
    nowIso,
  })
  const seededOpenAiVideoScript = ensureDefaultRegistryEntry({
    entries: seededDeerFlowText.entries,
    nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
    formId: FLOW_OPENAI_VIDEO_SCRIPT_FORM_ID,
    draft: buildOpenAiVideoScriptRegistryDraft(),
    nowIso,
  })
  const seededVideoTranscriber = ensureDefaultRegistryEntry({
    entries: seededOpenAiVideoScript.entries,
    nodeTypeId: FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
    formId: FLOW_VIDEO_TRANSCRIBER_FORM_ID,
    draft: buildVideoTranscriberRegistryDraft(),
    nowIso,
  })
  const seededRichMediaPanel = ensureDefaultRegistryEntry({
    entries: seededVideoTranscriber.entries,
    nodeTypeId: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    formId: FLOW_RICH_MEDIA_PANEL_FORM_ID,
    draft: buildRichMediaPanelRegistryDraft(),
    nowIso,
  })
  const seededGrabMapsDiscovery = ensureDefaultRegistryEntry({
    entries: seededRichMediaPanel.entries,
    nodeTypeId: FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
    formId: FLOW_GRABMAPS_DISCOVERY_FORM_ID,
    draft: buildGrabMapsDiscoveryRegistryDraft(),
    nowIso,
  })
  return {
    entries: seededGrabMapsDiscovery.entries,
    changed:
      seededImage.changed
      || seededVideo.changed
      || seededText.changed
      || seededVideoScript.changed
      || seededOpenAiText.changed
      || seededDeerFlowText.changed
      || seededOpenAiVideoScript.changed
      || seededVideoTranscriber.changed
      || seededRichMediaPanel.changed
      || seededGrabMapsDiscovery.changed,
  }
}

export function ensureDefaultGenerateVideoRegistryEntry(
  entries: WidgetRegistryEntry[],
  nowIso?: string,
): { entries: WidgetRegistryEntry[]; changed: boolean } {
  return ensureDefaultWidgetRegistryEntries(entries, nowIso)
}

export const planFlowEditorManagerDefaultRegistrySeed = (storage: Storage | null = getLocalStorage()) => {
  const rawInitial = readWidgetRegistryFromStorage(storage)
  const seeded = ensureDefaultWidgetRegistryEntries(rawInitial)
  return {
    storage,
    entries: seeded.entries,
    changed: seeded.changed,
  }
}

export const applyFlowEditorManagerDefaultRegistrySeed = (storage: Storage | null = getLocalStorage()): boolean => {
  const plan = planFlowEditorManagerDefaultRegistrySeed(storage)
  if (!plan.changed) return false
  writeWidgetRegistryToStorage(plan.storage, plan.entries)
  return true
}

export const createFlowEditorManagerSlice = (set: SetGraph, get: GetGraph) => {
  const initialPlan = planFlowEditorManagerDefaultRegistrySeed(getLocalStorage())
  const initial = initialPlan.entries

  const isWidgetRegistryEntry = (entry: WidgetRegistryEntry | null | undefined): boolean => {
    const nodeTypeId = String(entry?.nodeTypeId || '').trim()
    return (
      nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
      || nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID
      || nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
      || nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID
      || nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    )
  }

  const persist = (next: WidgetRegistryEntry[]) => {
    try {
      lsSetJson(LS_KEYS.flowEditorManagerWidgetRegistry, next)
    } catch {
      void 0
    }
  }
  const pickEffective = (
    global: WidgetRegistryEntry[],
    doc: WidgetRegistryEntry[],
    graphData?: GraphState['graphData'],
  ) => {
    const g = Array.isArray(global) ? global : []
    const d = Array.isArray(doc) ? doc : []
    const widgetGlobals = g.filter(isWidgetRegistryEntry)
    const graphMeta = (graphData?.metadata || {}) as Record<string, unknown>
    const graphKind = String(graphMeta.kind || '').trim()
    if (graphKind === 'frontmatter-flow') {
      if (d.length === 0) return widgetGlobals
      const seen = new Set(d.map(entry => `${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      const mergedWidgets = widgetGlobals.filter(entry => !seen.has(`${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      return [...d, ...mergedWidgets]
    }
    // Document-scoped registry is authoritative while present, but widget seeds stay globally available.
    if (d.length > 0) {
      const seen = new Set(d.map(entry => `${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      const mergedWidgets = widgetGlobals.filter(entry => !seen.has(`${entry.nodeTypeId}:${entry.formId}:${entry.widgetTypeId}`))
      return [...d, ...mergedWidgets]
    }
    return g
  }
  const upsert = (entry: Omit<WidgetRegistryEntry, 'id' | 'updatedAt'> & { id?: string | null }) => {
    const state = get()
    const prev = state.widgetRegistry || []

    const requestedId = trimOrEmpty(entry.id)
    const usedIds = new Set(prev.map(e => String(e.id || '')).filter(Boolean))
    const id = requestedId || createUniqueId('qer', usedIds)
    const updatedAt = new Date().toISOString()

    const nextEntry: WidgetRegistryEntry = {
      id,
      isEnabled: entry.isEnabled,
      nodeTypeId: String(entry.nodeTypeId || '').trim(),
      widgetTypeId: String(entry.widgetTypeId || '').trim(),
      formId: String(entry.formId || '').trim(),
      fields: Array.isArray(entry.fields) ? entry.fields : [],
      ports: Array.isArray(entry.ports) ? entry.ports : [],
      ...(Array.isArray(entry.schemaMappings) ? { schemaMappings: entry.schemaMappings } : {}),
      updatedAt,
    }

    const validated = validateWidgetRegistryEntry(nextEntry)
    if (!validated) return { ok: false as const, message: 'Invalid registry entry.' }

    const conflict = prev.find(e => {
      if (e.id === validated.id) return false
      if (!e.isEnabled || !validated.isEnabled) return false
      return (
        e.nodeTypeId === validated.nodeTypeId &&
        e.widgetTypeId === validated.widgetTypeId &&
        e.formId === validated.formId
      )
    })
    if (conflict) {
      return { ok: false as const, message: 'Conflict: an enabled mapping already exists for this node/editor/form.' }
    }

    const replaced = prev.some(e => e.id === validated.id)
    const next = normalizeWidgetRegistryEntries(
      replaced ? prev.map(e => (e.id === validated.id ? validated : e)) : [...prev, validated],
    )
    persist(next)
    set(s => {
      const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
      return {
        widgetRegistry: next,
        effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
      }
    })
    return { ok: true as const, id: validated.id }
  }

  return {
    widgetRegistry: initial,
    documentWidgetRegistry: [],
    effectiveWidgetRegistry: initial,
    setWidgetRegistry: (entries: WidgetRegistryEntry[]) => {
      const next = normalizeWidgetRegistryEntries(Array.isArray(entries) ? entries : [])
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
        return {
          widgetRegistry: next,
          effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
        }
      })
    },
    setDocumentWidgetRegistry: (
      entries: WidgetRegistryEntry[],
      options?: { graphData?: GraphState['graphData'] | null },
    ) => {
      const doc = normalizeWidgetRegistryEntries(Array.isArray(entries) ? entries : [])
      const global = Array.isArray(get().widgetRegistry) ? get().widgetRegistry : []
      const graphData = options?.graphData !== undefined ? (options.graphData || null) : get().graphData
      set({
        documentWidgetRegistry: doc,
        effectiveWidgetRegistry: pickEffective(global, doc, graphData),
      })
    },
    upsertWidgetRegistryEntry: upsert,
    removeWidgetRegistryEntry: (id: string) => {
      const entryId = trimOrEmpty(id)
      if (!entryId) return
      const state = get()
      const prev = state.widgetRegistry || []
      const next = prev.filter(e => e.id !== entryId)
      if (next.length === prev.length) return
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
        return {
          widgetRegistry: next,
          effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
        }
      })
    },
    toggleWidgetRegistryEntryEnabled: (id: string, enabled?: boolean) => {
      const entryId = trimOrEmpty(id)
      if (!entryId) return
      const state = get()
      const prev = state.widgetRegistry || []
      const current = prev.find(e => e.id === entryId) || null
      if (!current) return
      const nextEnabled = typeof enabled === 'boolean' ? enabled : !current.isEnabled
      if (nextEnabled === current.isEnabled) return

      const conflict = prev.find(e => {
        if (e.id === entryId) return false
        if (!e.isEnabled || !nextEnabled) return false
        return (
          e.nodeTypeId === current.nodeTypeId &&
          e.widgetTypeId === current.widgetTypeId &&
          e.formId === current.formId
        )
      })
      if (conflict) {
        state.upsertUiToast({
          id: 'flow-editor-manager-registry-conflict',
          kind: 'warning',
          message: 'Enable denied: another enabled mapping already exists for this node/editor/form.',
          ttlMs: 3000,
        })
        return
      }

      const next = prev.map(e => (e.id === entryId ? { ...e, isEnabled: nextEnabled, updatedAt: new Date().toISOString() } : e))
      persist(next)
      set(s => {
        const doc = Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : []
        return {
          widgetRegistry: next,
          effectiveWidgetRegistry: pickEffective(next, doc, s.graphData),
        }
      })
    },
  }
}
