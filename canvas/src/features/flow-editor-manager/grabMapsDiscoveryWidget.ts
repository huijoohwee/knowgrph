import { settingsRegistry } from '@/features/settings/registry'
import type { SettingMeta } from '@/features/settings/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export const FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID = 'GrabMapsDiscovery' as const
export const FLOW_GRABMAPS_DISCOVERY_WIDGET_TYPE_ID = 'grabmaps' as const
export const FLOW_GRABMAPS_DISCOVERY_FORM_ID = 'grabmaps.discovery' as const
export const GRABMAPS_DISCOVERY_WIDGET_ID = FLOW_GRABMAPS_DISCOVERY_FORM_ID
export const GRABMAPS_DISCOVERY_WIDGET_LABEL = 'GrabMap Discovery Widget' as const

export type DiscoverySettingKey =
  | 'maps.grabmaps.mcp.searchPlaces.query'
  | 'maps.grabmaps.mcp.searchPlaces.country'
  | 'maps.grabmaps.mcp.searchPlaces.lat'
  | 'maps.grabmaps.mcp.searchPlaces.lon'
  | 'maps.grabmaps.mcp.searchPlaces.limit'
  | 'maps.grabmaps.mcp.nearbySearch.lat'
  | 'maps.grabmaps.mcp.nearbySearch.lon'
  | 'maps.grabmaps.mcp.nearbySearch.radius'
  | 'maps.grabmaps.mcp.nearbySearch.limit'
  | 'maps.grabmaps.mcp.nearbySearch.rankBy'
  | 'maps.grabmaps.mcp.nearbySearch.language'
  | 'maps.grabmaps.mcp.nearbySearch.category'

export type DiscoveryPropertyKey =
  | 'searchQuery'
  | 'searchCountry'
  | 'searchLat'
  | 'searchLon'
  | 'searchLimit'
  | 'nearbyLat'
  | 'nearbyLon'
  | 'nearbyRadiusKm'
  | 'nearbyLimit'
  | 'nearbyRankBy'
  | 'nearbyLanguage'
  | 'nearbyCategory'

export type DiscoveryWidgetProperties = Record<DiscoveryPropertyKey, unknown>
export type GrabMapsDiscoverySettingsValues = Partial<Record<DiscoverySettingKey, string | number | boolean>>

export const GRABMAPS_DISCOVERY_FIELD_META: ReadonlyArray<{
  propertyKey: DiscoveryPropertyKey
  settingKey: DiscoverySettingKey
  label: string
  fieldType: 'text' | 'number' | 'select'
  placeholder?: string
  options?: ReadonlyArray<{ value: string | number; label: string }>
}> = [
  {
    propertyKey: 'searchQuery',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.query',
    label: 'Search Query',
    fieldType: 'text',
    placeholder: 'Marina Bay Sands, night markets, waterfront ferries',
  },
  {
    propertyKey: 'searchCountry',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.country',
    label: 'Country',
    fieldType: 'text',
    placeholder: 'SGP',
  },
  {
    propertyKey: 'searchLat',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.lat',
    label: 'Location Bias Lat',
    fieldType: 'number',
  },
  {
    propertyKey: 'searchLon',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.lon',
    label: 'Location Bias Lon',
    fieldType: 'number',
  },
  {
    propertyKey: 'searchLimit',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.limit',
    label: 'Result Limit',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyLat',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.lat',
    label: 'Nearby Lat',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyLon',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.lon',
    label: 'Nearby Lon',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyRadiusKm',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.radius',
    label: 'Nearby Radius (km)',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyLimit',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.limit',
    label: 'Nearby Limit',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyRankBy',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.rankBy',
    label: 'Nearby Rank',
    fieldType: 'select',
    options: [
      { value: 'distance', label: 'distance' },
      { value: 'popularity', label: 'popularity' },
    ],
  },
  {
    propertyKey: 'nearbyLanguage',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.language',
    label: 'Language',
    fieldType: 'text',
  },
  {
    propertyKey: 'nearbyCategory',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.category',
    label: 'Category',
    fieldType: 'text',
    placeholder: 'restaurant',
  },
] as const

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
    meta.write(value)
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
    fields: GRABMAPS_DISCOVERY_FIELD_META.map(field => ({
      fieldKey: field.propertyKey,
      label: field.label,
      fieldType: field.fieldType,
      schemaPath: `properties.${field.propertyKey}`,
      ...(field.options ? { options: [...field.options] } : {}),
    })),
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
