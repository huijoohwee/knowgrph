import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  buildGrabMapsDiscoveryFields,
  GRABMAPS_DISCOVERY_FIELD_META,
  GRABMAPS_DISCOVERY_WIDGET_LABEL,
  type DiscoveryPropertyKey,
  type DiscoverySettingKey,
} from '@/features/integrations/grabMapsSsot'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsFloat, lsJson, lsSetFloat, lsSetJson } from '@/lib/persistence'

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

const DISCOVERY_SETTING_SPECS: Readonly<Record<DiscoverySettingKey, DiscoverySettingSpec>> = {
  'maps.grabmaps.mcp.discovery.chatModel': {
    storageKey: LS_KEYS.grabMapsMcpDiscoveryChatModel,
    valueType: 'string',
    defaultValue: 'gpt-5.4-nano',
    options: ['gpt-5.4-nano'],
  },
  'maps.grabmaps.mcp.searchPlaces.query': {
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesQuery,
    valueType: 'string',
    defaultValue: 'restaurants Marina Bay',
  },
  'maps.grabmaps.mcp.searchPlaces.country': {
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesCountry,
    valueType: 'string',
    defaultValue: 'SGP',
  },
  'maps.grabmaps.mcp.searchPlaces.lat': {
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesLat,
    valueType: 'number',
    defaultValue: 1.3521,
    min: -90,
    max: 90,
  },
  'maps.grabmaps.mcp.searchPlaces.lon': {
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesLon,
    valueType: 'number',
    defaultValue: 103.8198,
    min: -180,
    max: 180,
  },
  'maps.grabmaps.mcp.searchPlaces.limit': {
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesLimit,
    valueType: 'number',
    defaultValue: 10,
    min: 1,
    max: 50,
  },
  'maps.grabmaps.mcp.nearbySearch.lat': {
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLat,
    valueType: 'number',
    defaultValue: 1.3521,
    min: -90,
    max: 90,
  },
  'maps.grabmaps.mcp.nearbySearch.lon': {
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLon,
    valueType: 'number',
    defaultValue: 103.8198,
    min: -180,
    max: 180,
  },
  'maps.grabmaps.mcp.nearbySearch.radius': {
    storageKey: LS_KEYS.grabMapsMcpNearbySearchRadius,
    valueType: 'number',
    defaultValue: 1,
    min: 0,
    max: 50,
  },
  'maps.grabmaps.mcp.nearbySearch.limit': {
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLimit,
    valueType: 'number',
    defaultValue: 10,
    min: 1,
    max: 50,
  },
  'maps.grabmaps.mcp.nearbySearch.rankBy': {
    storageKey: LS_KEYS.grabMapsMcpNearbySearchRankBy,
    valueType: 'string',
    defaultValue: 'distance',
    options: ['distance', 'popularity'],
  },
  'maps.grabmaps.mcp.nearbySearch.language': {
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLanguage,
    valueType: 'string',
    defaultValue: 'en',
  },
  'maps.grabmaps.mcp.nearbySearch.category': {
    storageKey: LS_KEYS.grabMapsMcpNearbySearchCategory,
    valueType: 'string',
    defaultValue: 'restaurant',
  },
}

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
