import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  buildGrabMapsDiscoveryFields,
  GRABMAPS_DISCOVERY_FIELD_META,
  GRABMAPS_DISCOVERY_SETTING_SPECS,
  GRABMAPS_DISCOVERY_WIDGET_LABEL,
  type DiscoveryPropertyKey,
  type DiscoverySettingKey,
} from '@/features/integrations/grabMapsSsot'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsFloat, lsJson, lsSetFloat, lsSetJson } from '@/lib/persistence'

export { GRABMAPS_DISCOVERY_FIELD_META, GRABMAPS_DISCOVERY_SETTING_SPECS } from '@/features/integrations/grabMapsSsot'

export const FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID = 'GrabMapsDiscovery' as const
export const FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID = 'grabmaps' as const
export const FLOW_GRABMAPS_DISCOVERY_FORM_ID = 'grabmaps.discovery' as const
export const GRABMAPS_DISCOVERY_WIDGET_ID = FLOW_GRABMAPS_DISCOVERY_FORM_ID

export type DiscoveryWidgetProperties = Record<DiscoveryPropertyKey, unknown>
export type GrabMapsDiscoverySettingsValues = Partial<Record<DiscoverySettingKey, string | number | boolean>>

type DiscoverySettingSpec = {
  storageKey: string
  valueType: 'string' | 'number'
  defaultValue: string | number
  min?: number
  max?: number
  options?: readonly string[]
}

const DISCOVERY_SETTING_STORAGE_KEYS: Readonly<Record<DiscoverySettingKey, string>> = {
  'maps.grabmaps.mcp.discovery.chatModel': LS_KEYS.grabMapsMcpDiscoveryChatModel,
  'maps.grabmaps.mcp.searchPlaces.query': LS_KEYS.grabMapsMcpSearchPlacesQuery,
  'maps.grabmaps.mcp.searchPlaces.country': LS_KEYS.grabMapsMcpSearchPlacesCountry,
  'maps.grabmaps.mcp.searchPlaces.lat': LS_KEYS.grabMapsMcpSearchPlacesLat,
  'maps.grabmaps.mcp.searchPlaces.lon': LS_KEYS.grabMapsMcpSearchPlacesLon,
  'maps.grabmaps.mcp.searchPlaces.limit': LS_KEYS.grabMapsMcpSearchPlacesLimit,
  'maps.grabmaps.mcp.nearbySearch.lat': LS_KEYS.grabMapsMcpNearbySearchLat,
  'maps.grabmaps.mcp.nearbySearch.lon': LS_KEYS.grabMapsMcpNearbySearchLon,
  'maps.grabmaps.mcp.nearbySearch.radius': LS_KEYS.grabMapsMcpNearbySearchRadius,
  'maps.grabmaps.mcp.nearbySearch.limit': LS_KEYS.grabMapsMcpNearbySearchLimit,
  'maps.grabmaps.mcp.nearbySearch.rankBy': LS_KEYS.grabMapsMcpNearbySearchRankBy,
  'maps.grabmaps.mcp.nearbySearch.language': LS_KEYS.grabMapsMcpNearbySearchLanguage,
  'maps.grabmaps.mcp.nearbySearch.category': LS_KEYS.grabMapsMcpNearbySearchCategory,
}

const DISCOVERY_SETTING_SPECS: Readonly<Record<DiscoverySettingKey, DiscoverySettingSpec>> = (
  Object.keys(GRABMAPS_DISCOVERY_SETTING_SPECS) as DiscoverySettingKey[]
).reduce((acc, key) => {
  acc[key] = {
    storageKey: DISCOVERY_SETTING_STORAGE_KEYS[key],
    ...GRABMAPS_DISCOVERY_SETTING_SPECS[key],
  }
  return acc
}, {} as Record<DiscoverySettingKey, DiscoverySettingSpec>)

function readSettingValue(key: DiscoverySettingKey): unknown {
  const spec = DISCOVERY_SETTING_SPECS[key]
  if (!spec) return ''
  if (spec.valueType === 'string') {
    return lsJson<string>(spec.storageKey, String(spec.defaultValue), value => {
      const normalized = String(value ?? '').trim()
      if (!normalized) return String(spec.defaultValue)
      if (spec.options && spec.options.length > 0 && !spec.options.includes(normalized)) {
        return String(spec.defaultValue)
      }
      return normalized
    })
  }
  return lsFloat(spec.storageKey, Number(spec.defaultValue), {
    ...(typeof spec.min === 'number' ? { min: spec.min } : {}),
    ...(typeof spec.max === 'number' ? { max: spec.max } : {}),
  })
}

function writeSettingValue(key: DiscoverySettingKey, value: unknown): void {
  const spec = DISCOVERY_SETTING_SPECS[key]
  if (!spec) return
  if (spec.valueType === 'string') {
    const normalized = String(value ?? '').trim() || String(spec.defaultValue)
    const next =
      spec.options && spec.options.length > 0 && !spec.options.includes(normalized)
        ? String(spec.defaultValue)
        : normalized
    lsSetJson(spec.storageKey, next)
    return
  }
  lsSetFloat(spec.storageKey, Number(value), {
    ...(typeof spec.min === 'number' ? { min: spec.min } : {}),
    ...(typeof spec.max === 'number' ? { max: spec.max } : {}),
  })
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
    const spec = DISCOVERY_SETTING_SPECS[field.settingKey]
    next[field.propertyKey] = spec ? spec.defaultValue : ''
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
    const value = DISCOVERY_SETTING_SPECS[field.settingKey]?.defaultValue
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

function normalizeLocalOverrideValue(
  value: unknown,
  spec: DiscoverySettingSpec,
): string | number | boolean | undefined {
  if (spec.valueType === 'string') {
    const normalized = String(value ?? '').trim()
    if (!normalized) return undefined
    if (spec.options && spec.options.length > 0 && !spec.options.includes(normalized)) return undefined
    return normalized
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const withMin = typeof spec.min === 'number' ? Math.max(spec.min, parsed) : parsed
  const withBounds = typeof spec.max === 'number' ? Math.min(spec.max, withMin) : withMin
  return withBounds
}

export function resolveEffectiveGrabMapsDiscoverySettingsValues(args: {
  globalSettings: GrabMapsDiscoverySettingsValues
  localProperties?: Record<string, unknown> | null | undefined
}): GrabMapsDiscoverySettingsValues {
  const merged: GrabMapsDiscoverySettingsValues = { ...(args.globalSettings || {}) }
  const local = args.localProperties || {}
  for (const field of GRABMAPS_DISCOVERY_FIELD_META) {
    if (!Object.prototype.hasOwnProperty.call(local, field.propertyKey)) continue
    const spec = DISCOVERY_SETTING_SPECS[field.settingKey]
    if (!spec) continue
    const normalized = normalizeLocalOverrideValue(local[field.propertyKey], spec)
    if (typeof normalized === 'undefined') continue
    merged[field.settingKey] = normalized
  }
  return merged
}
