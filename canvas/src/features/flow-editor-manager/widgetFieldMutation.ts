import { getObjectPath, setObjectPath } from '@/lib/data/objectPath'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import type { WidgetRegistryField } from '@/features/flow-editor-manager/widgetRegistryTypes'

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonValue(value: string): unknown {
  const text = value.trim()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function coerceBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0
  if (typeof value !== 'string') return Boolean(value)
  const text = value.trim().toLowerCase()
  if (!text) return undefined
  if (text === 'true' || text === '1' || text === 'yes' || text === 'on') return true
  if (text === 'false' || text === '0' || text === 'no' || text === 'off') return false
  return undefined
}

export function normalizeWidgetFieldSchemaPath(schemaPath: unknown, fallbackKey: unknown): string {
  const raw = pickString(schemaPath) || pickString(fallbackKey)
  if (!raw) return ''
  if (raw.startsWith('properties.') || raw.startsWith('metadata.') || raw === 'label' || raw === 'type') return raw
  return `properties.${raw}`
}

export function coerceWidgetFieldValue(args: { fieldType: unknown; value: unknown }): unknown {
  const fieldType = pickString(args.fieldType).toLowerCase()
  const value = args.value
  if (fieldType === 'boolean' || fieldType === 'bool') return coerceBooleanValue(value)
  if (fieldType === 'number' || fieldType === 'int' || fieldType === 'integer' || fieldType === 'float') {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }
    return undefined
  }
  if (fieldType === 'array') {
    if (Array.isArray(value)) return value
    if (typeof value !== 'string') return undefined
    const parsed = parseJsonValue(value)
    return Array.isArray(parsed) ? parsed : undefined
  }
  if (fieldType === 'object') {
    if (isPlainRecord(value)) return value
    if (typeof value !== 'string') return undefined
    const parsed = parseJsonValue(value)
    return isPlainRecord(parsed) ? parsed : undefined
  }
  if (fieldType === 'json') {
    if (typeof value !== 'string') return value
    const parsed = parseJsonValue(value)
    return typeof parsed === 'undefined' ? value : parsed
  }
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function isEmptyWidgetFieldValue(args: { fieldType: unknown; value: unknown }): boolean {
  const fieldType = pickString(args.fieldType).toLowerCase()
  const value = args.value
  if (typeof value === 'undefined' || value === null) return true
  if (fieldType === 'boolean' || fieldType === 'bool') return false
  if (fieldType === 'number' || fieldType === 'int' || fieldType === 'integer' || fieldType === 'float') return false
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

export function areWidgetFieldValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object' || a === null || b === null) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function applyWidgetFieldValueUpdate(args: {
  properties: Record<string, unknown>
  schemaPath: string
  nextValue: unknown
}): Record<string, unknown> {
  const path = pickString(args.schemaPath)
  if (!path) return args.properties
  const nextRoot = setObjectPath({ properties: args.properties }, path, args.nextValue) as {
    properties?: Record<string, unknown>
  }
  return nextRoot.properties || {}
}

export function applyConnectedWidgetFieldsToEmptyValues(args: {
  properties: Record<string, unknown>
  fields: ReadonlyArray<Pick<WidgetRegistryField, 'fieldKey' | 'fieldType' | 'schemaPath'>>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath | null
}): Record<string, unknown> | null {
  if (!args.connectedValuesBySchemaPath) return null
  let nextProperties = args.properties
  let changed = false
  for (let i = 0; i < args.fields.length; i += 1) {
    const field = args.fields[i]
    const schemaPath = normalizeWidgetFieldSchemaPath(field.schemaPath, field.fieldKey)
    if (!schemaPath) continue
    const connected = args.connectedValuesBySchemaPath[schemaPath]
    if (!connected) continue
    const currentValue = getObjectPath({ properties: nextProperties }, schemaPath)
    if (!isEmptyWidgetFieldValue({ fieldType: field.fieldType, value: currentValue })) continue
    const nextValue = coerceWidgetFieldValue({ fieldType: field.fieldType, value: connected.value })
    if (typeof nextValue === 'undefined') continue
    if (areWidgetFieldValuesEqual(currentValue, nextValue)) continue
    nextProperties = applyWidgetFieldValueUpdate({
      properties: nextProperties,
      schemaPath,
      nextValue,
    })
    changed = true
  }
  return changed ? nextProperties : null
}
