import { settingsRegistry } from '@/features/settings/registry'
import type { SettingMeta } from '@/features/settings/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  buildGrabMapsDiscoveryFields,
  GRABMAPS_DISCOVERY_FIELD_META,
  GRABMAPS_DISCOVERY_WIDGET_LABEL,
  type DiscoveryPropertyKey,
  type DiscoverySettingKey,
} from '@/features/integrations/grabMapsSsot'

export const FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID = 'GrabMapsDiscovery' as const
export const FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID = 'grabmaps' as const
export const FLOW_GRABMAPS_DISCOVERY_FORM_ID = 'grabmaps.discovery' as const
export const GRABMAPS_DISCOVERY_WIDGET_ID = FLOW_GRABMAPS_DISCOVERY_FORM_ID

export type DiscoveryWidgetProperties = Record<DiscoveryPropertyKey, unknown>
export type GrabMapsDiscoverySettingsValues = Partial<Record<DiscoverySettingKey, string | number | boolean>>

let settingMetaByKeyCache: Map<DiscoverySettingKey, SettingMeta> | null = null

function getSettingMetaByKey(): Map<DiscoverySettingKey, SettingMeta> {
  if (settingMetaByKeyCache) return settingMetaByKeyCache
  const targetKeys = new Set<DiscoverySettingKey>(GRABMAPS_DISCOVERY_FIELD_META.map(field => field.settingKey))
  const next = new Map<DiscoverySettingKey, SettingMeta>()
  for (const entry of settingsRegistry) {
    const key = entry.key as DiscoverySettingKey
    if (!targetKeys.has(key)) continue
    next.set(key, entry)
  }
  settingMetaByKeyCache = next
  return next
}

function getSettingMeta(key: DiscoverySettingKey): SettingMeta | null {
  return getSettingMetaByKey().get(key) || null
}

function readSettingValue(key: DiscoverySettingKey): unknown {
  const meta = getSettingMeta(key)
  if (!meta) return ''
  try {
    const value = meta.read()
    if (value != null) return value
  } catch {
    void 0
  }
  return meta.default?.() ?? ''
}

function writeSettingValue(key: DiscoverySettingKey, value: unknown): void {
  const meta = getSettingMeta(key)
  if (!meta?.write) return
  try {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      meta.write(value)
      return
    }
    meta.write(String(value ?? ''))
  } catch {
    void 0
  }
}

export function getGrabMapsDiscoveryWidgetLabel(): string {
  return GRABMAPS_DISCOVERY_WIDGET_LABEL
}

export function isGrabMapsDiscoveryWidgetEntry(args: {
  nodeTypeId?: unknown
  widgetTypeId?: unknown
  formId?: unknown
}): boolean {
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  const widgetTypeId = String(args.widgetTypeId || '').trim()
  const formId = String(args.formId || '').trim()
  if (formId !== FLOW_GRABMAPS_DISCOVERY_FORM_ID) return false
  if (nodeTypeId) return nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID
  if (widgetTypeId) return widgetTypeId === FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID
  return false
}

export function buildGrabMapsDiscoveryRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
    widgetTypeId: FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID,
    formId: FLOW_GRABMAPS_DISCOVERY_FORM_ID,
    fields: buildGrabMapsDiscoveryFields(),
    ports: [],
    schemaMappings: [],
  }
}

export function readGrabMapsDiscoveryWidgetProperties(): DiscoveryWidgetProperties {
  const next = {} as DiscoveryWidgetProperties
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    next[field.propertyKey] = readSettingValue(field.settingKey)
  }
  return next
}

export function readGrabMapsDiscoveryWidgetDefaultProperties(): DiscoveryWidgetProperties {
  const next = {} as DiscoveryWidgetProperties
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    const meta = getSettingMeta(field.settingKey)
    next[field.propertyKey] = meta?.default?.() ?? ''
  }
  return next
}

export function readGrabMapsDiscoverySettingsValues(): GrabMapsDiscoverySettingsValues {
  const next: GrabMapsDiscoverySettingsValues = {}
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    const value = readSettingValue(field.settingKey)
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[field.settingKey] = value
    }
  }
  return next
}

export function readGrabMapsDiscoveryDefaultSettingsValues(): GrabMapsDiscoverySettingsValues {
  const next: GrabMapsDiscoverySettingsValues = {}
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    const value = getSettingMeta(field.settingKey)?.default?.()
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[field.settingKey] = value
    }
  }
  return next
}

export function writeGrabMapsDiscoverySettingsValues(values: GrabMapsDiscoverySettingsValues): void {
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    if (!Object.prototype.hasOwnProperty.call(values, field.settingKey)) continue
    writeSettingValue(field.settingKey, values[field.settingKey])
  }
}

export function writeGrabMapsDiscoveryWidgetProperties(properties: DiscoveryWidgetProperties): void {
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    writeSettingValue(field.settingKey, properties[field.propertyKey])
  }
}
