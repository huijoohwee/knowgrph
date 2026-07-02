import { createUniqueId } from '@/lib/ids'

import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'

export type FlowMappingRowDirection = 'default' | 'input' | 'output'

export type FlowMappingRowType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'json'
  | 'select'
  | 'port'

export interface StoryboardWidgetMappingRow {
  id: string
  key: string
  type: FlowMappingRowType
  value: string
  required: boolean
  direction: FlowMappingRowDirection
  label?: string
  isHidden?: boolean
}

const clean = (v: unknown): string => String(v || '').trim()

export function buildMappingRowsFromRegistryEntry(entry: WidgetRegistryEntry): StoryboardWidgetMappingRow[] {
  const used = new Set<string>()
  const out: StoryboardWidgetMappingRow[] = []
  const fields = Array.isArray(entry.fields) ? entry.fields : []
  const ports = Array.isArray(entry.ports) ? entry.ports : []

  fields.forEach((f) => {
    const key = clean(f.fieldKey)
    if (!key) return
    const id = createUniqueId('qerRow', used)
    used.add(id)
    const isHidden = (f as unknown as { isHidden?: unknown }).isHidden === true
    out.push({
      id,
      key,
      type: (clean(f.fieldType).toLowerCase() as FlowMappingRowType) || 'text',
      value: clean(f.schemaPath),
      required: !!f.required,
      direction: 'default',
      ...(clean(f.label) ? { label: clean(f.label) } : {}),
      ...(isHidden ? { isHidden: true } : {}),
    })
  })

  ports.forEach((p) => {
    const key = clean(p.portKey)
    const direction = clean(p.direction)
    if (!key) return
    if (direction !== 'input' && direction !== 'output') return
    const id = createUniqueId('qerRow', used)
    used.add(id)
    const isHidden = (p as unknown as { isHidden?: unknown }).isHidden === true
    out.push({
      id,
      key,
      type: 'port',
      value: clean(p.schemaPath),
      required: false,
      direction: direction as 'input' | 'output',
      ...(isHidden ? { isHidden: true } : {}),
    })
  })

  return out
}

export function validateMappingRows(rows: StoryboardWidgetMappingRow[]): string | null {
  const src = Array.isArray(rows) ? rows : []
  if (src.length === 0) return 'Add at least one row.'
  const fieldKeySet = new Set<string>()
  const portKeySet = new Set<string>()

  for (let i = 0; i < src.length; i += 1) {
    const r = src[i]
    const key = clean(r.key)
    if (!key) return 'Every row needs a Key.'
    const type = clean(r.type)
    if (!type) return 'Every row needs a Type.'

    if (r.type === 'port' || r.direction === 'input' || r.direction === 'output') {
      if (r.direction !== 'input' && r.direction !== 'output') return 'Port rows need a Direction.'
      const uniq = `${r.direction}:${key}`
      if (portKeySet.has(uniq)) return `Duplicate port: ${uniq}`
      portKeySet.add(uniq)
      continue
    }

    if (r.direction !== 'default') return 'Non-port rows must use Direction=default.'
    if (fieldKeySet.has(key)) return `Duplicate key: ${key}`
    fieldKeySet.add(key)
  }

  return null
}

export function applyMappingRowsToRegistryEntry(args: {
  entry: WidgetRegistryEntry
  rows: StoryboardWidgetMappingRow[]
}): WidgetRegistryEntry {
  const rows = Array.isArray(args.rows) ? args.rows : []
  const prev = args.entry
  const prevFieldLabelByKey = new Map<string, string>()
  ;(prev.fields || []).forEach(f => {
    const k = clean(f.fieldKey)
    const label = clean(f.label)
    if (k && label) prevFieldLabelByKey.set(k, label)
  })

  const fields: WidgetRegistryEntry['fields'] = []
  const ports: WidgetRegistryEntry['ports'] = []

  rows.forEach((r) => {
    const key = clean(r.key)
    if (!key) return
    const value = clean(r.value)
    const isHidden = r.isHidden === true

    if (r.type === 'port' || r.direction === 'input' || r.direction === 'output') {
      const direction = r.direction === 'input' || r.direction === 'output' ? r.direction : 'input'
      ports.push({
        portKey: key,
        direction,
        ...(value ? { schemaPath: value } : {}),
        ...(isHidden ? { isHidden: true } : {}),
      })
      return
    }

    const label = clean(r.label) || prevFieldLabelByKey.get(key) || ''
    fields.push({
      fieldKey: key,
      fieldType: r.type,
      ...(value ? { schemaPath: value } : {}),
      ...(r.required ? { required: true } : {}),
      ...(label ? { label } : {}),
      ...(isHidden ? { isHidden: true } : {}),
    })
  })

  return {
    ...prev,
    fields,
    ports,
    updatedAt: new Date().toISOString(),
  }
}
