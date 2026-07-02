import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { WidgetRegistryField, WidgetRegistryFieldOption } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import type { VirtualSettingsEntry } from '@/features/panels/views/byteplusSharedTextApiDocs'
import { CHAT_DEFAULT_MODEL } from '@/lib/chatEndpoint'
import {
  GRABMAPS_DOC_ROWS,
  MAPS_GEO_DOC_AREA,
  MAPS_GRABMAPS_DOC_AREA,
  MAPS_GRABMAPS_MCP_DOC_AREA,
  MAPS_MAPLIBRE_DOC_AREA,
  type GrabMapsApiDocRow,
} from './grabMapsSsot.rows'

export { MAPS_GEO_DOC_AREA, MAPS_GRABMAPS_DOC_AREA, MAPS_GRABMAPS_MCP_DOC_AREA, MAPS_MAPLIBRE_DOC_AREA }

export const GRABMAPS_DISCOVERY_WIDGET_LABEL = 'GrabMaps Chat Discovery Widget' as const

export type DiscoverySettingKey =
  | 'maps.grabmaps.mcp.discovery.chatModel'
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
  | 'chatModel'
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

export type GrabMapsDiscoveryFieldMeta = {
  propertyKey: DiscoveryPropertyKey
  settingKey: DiscoverySettingKey
  mapsRowKey: string
  label: string
  fieldType: 'text' | 'number' | 'select'
  placeholder?: string
  options?: ReadonlyArray<WidgetRegistryFieldOption>
}

export type GrabMapsDiscoverySettingSpec = {
  valueType: 'string' | 'number'
  defaultValue: string | number
  min?: number
  max?: number
  options?: readonly string[]
}

const GRABMAPS_TOOLTIP_ROLE = 'GrabMaps'

const GRABMAPS_KEY_ACTIONS_BY_VALUE_KEY: Readonly<Record<string, string[]>> = {
  'maps.grabmaps.authMode': ['select auth mode', 'set trust boundary for GrabMaps calls'],
  'maps.grabmaps.apiKey': ['hold memory-only BYOK secret', 'authorize proxy-backed GrabMaps requests'],
  'maps.grabmaps.basemap.styleUrl': ['pin style URL', 'keep basemap loading on one shared endpoint'],
  'maps.grabmaps.mcp.discovery.chatModel': ['select planner model', 'keep discovery planning aligned with widget defaults'],
  'maps.grabmaps.mcp.searchPlaces.query': ['set default search query', 'seed keyword-search discovery runs'],
  'maps.grabmaps.mcp.searchPlaces.country': ['set country bias', 'narrow keyword-search relevance'],
  'maps.grabmaps.mcp.searchPlaces.limit': ['cap keyword results', 'bound discovery list size'],
  'maps.grabmaps.mcp.nearbySearch.radius': ['set nearby radius', 'expand or contract place coverage'],
  'maps.grabmaps.mcp.nearbySearch.limit': ['cap nearby results', 'bound nearby list size'],
  'maps.grabmaps.mcp.nearbySearch.rankBy': ['select ranking mode', 'sort nearby results by distance or popularity'],
  'maps.grabmaps.mcp.nearbySearch.language': ['set output language', 'localize nearby place labels'],
  'maps.grabmaps.mcp.nearbySearch.category': ['set nearby category', 'narrow nearby results to one POI class'],
}

function toBaseType(typeLabel: string): SettingMeta['type'] {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

function buildDetailNotes(row: GrabMapsApiDocRow): string {
  return [
    `Value description: ${row.valueDescription}`,
    `SSOT: ${row.ssot}`,
    String(row.notes || '').trim(),
  ]
    .filter(Boolean)
    .join('\n')
}

export function getMapsApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `maps-row-${normalized || 'entry'}`
}

export const GRABMAPS_DISCOVERY_FIELD_META: ReadonlyArray<GrabMapsDiscoveryFieldMeta> = [
  {
    propertyKey: 'chatModel',
    settingKey: 'maps.grabmaps.mcp.discovery.chatModel',
    mapsRowKey: 'maps.grabmaps.mcp.discovery.chat_model',
    label: 'Discovery Chat Model',
    fieldType: 'select',
    options: [{ value: CHAT_DEFAULT_MODEL, label: CHAT_DEFAULT_MODEL }],
  },
  {
    propertyKey: 'searchQuery',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.query',
    mapsRowKey: 'maps.grabmaps.mcp.search_places.query',
    label: 'Search Query',
    fieldType: 'text',
    placeholder: 'Marina Bay Sands, night markets, waterfront ferries',
  },
  {
    propertyKey: 'searchCountry',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.country',
    mapsRowKey: 'maps.grabmaps.mcp.search_places.country',
    label: 'Country',
    fieldType: 'text',
    placeholder: 'SGP',
  },
  {
    propertyKey: 'searchLat',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.lat',
    mapsRowKey: 'maps.grabmaps.mcp.search_places.location',
    label: 'Location Bias Lat',
    fieldType: 'number',
  },
  {
    propertyKey: 'searchLon',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.lon',
    mapsRowKey: 'maps.grabmaps.mcp.search_places.location',
    label: 'Location Bias Lon',
    fieldType: 'number',
  },
  {
    propertyKey: 'searchLimit',
    settingKey: 'maps.grabmaps.mcp.searchPlaces.limit',
    mapsRowKey: 'maps.grabmaps.mcp.search_places.limit',
    label: 'Result Limit',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyLat',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.lat',
    mapsRowKey: 'maps.grabmaps.mcp.nearby_search.location',
    label: 'Nearby Lat',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyLon',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.lon',
    mapsRowKey: 'maps.grabmaps.mcp.nearby_search.location',
    label: 'Nearby Lon',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyRadiusKm',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.radius',
    mapsRowKey: 'maps.grabmaps.mcp.nearby_search.radius',
    label: 'Nearby Radius (km)',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyLimit',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.limit',
    mapsRowKey: 'maps.grabmaps.mcp.nearby_search.limit',
    label: 'Nearby Limit',
    fieldType: 'number',
  },
  {
    propertyKey: 'nearbyRankBy',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.rankBy',
    mapsRowKey: 'maps.grabmaps.mcp.nearby_search.rank_by',
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
    mapsRowKey: 'maps.grabmaps.mcp.nearby_search.language',
    label: 'Language',
    fieldType: 'text',
  },
  {
    propertyKey: 'nearbyCategory',
    settingKey: 'maps.grabmaps.mcp.nearbySearch.category',
    mapsRowKey: 'maps.grabmaps.mcp.nearby_search.category',
    label: 'Category',
    fieldType: 'text',
    placeholder: 'restaurant',
  },
] as const

export const GRABMAPS_DISCOVERY_SETTING_SPECS: Readonly<Record<DiscoverySettingKey, GrabMapsDiscoverySettingSpec>> = {
  'maps.grabmaps.mcp.discovery.chatModel': {
    valueType: 'string',
    defaultValue: CHAT_DEFAULT_MODEL,
    options: [CHAT_DEFAULT_MODEL],
  },
  'maps.grabmaps.mcp.searchPlaces.query': {
    valueType: 'string',
    defaultValue: 'restaurants Marina Bay',
  },
  'maps.grabmaps.mcp.searchPlaces.country': {
    valueType: 'string',
    defaultValue: 'SGP',
  },
  'maps.grabmaps.mcp.searchPlaces.lat': {
    valueType: 'number',
    defaultValue: 1.3521,
    min: -90,
    max: 90,
  },
  'maps.grabmaps.mcp.searchPlaces.lon': {
    valueType: 'number',
    defaultValue: 103.8198,
    min: -180,
    max: 180,
  },
  'maps.grabmaps.mcp.searchPlaces.limit': {
    valueType: 'number',
    defaultValue: 10,
    min: 1,
    max: 50,
  },
  'maps.grabmaps.mcp.nearbySearch.lat': {
    valueType: 'number',
    defaultValue: 1.3521,
    min: -90,
    max: 90,
  },
  'maps.grabmaps.mcp.nearbySearch.lon': {
    valueType: 'number',
    defaultValue: 103.8198,
    min: -180,
    max: 180,
  },
  'maps.grabmaps.mcp.nearbySearch.radius': {
    valueType: 'number',
    defaultValue: 1,
    min: 0,
    max: 50,
  },
  'maps.grabmaps.mcp.nearbySearch.limit': {
    valueType: 'number',
    defaultValue: 10,
    min: 1,
    max: 50,
  },
  'maps.grabmaps.mcp.nearbySearch.rankBy': {
    valueType: 'string',
    defaultValue: 'distance',
    options: ['distance', 'popularity'],
  },
  'maps.grabmaps.mcp.nearbySearch.language': {
    valueType: 'string',
    defaultValue: 'en',
  },
  'maps.grabmaps.mcp.nearbySearch.category': {
    valueType: 'string',
    defaultValue: 'restaurant',
  },
}

export function buildGrabMapsDiscoveryFields(): WidgetRegistryField[] {
  return GRABMAPS_DISCOVERY_FIELD_META.map(field => ({
    fieldKey: field.propertyKey,
    label: field.label,
    fieldType: field.fieldType,
    schemaPath: `properties.${field.propertyKey}`,
    ...(field.options ? { options: [...field.options] } : {}),
  }))
}

export function resolveGrabMapsDiscoveryWidgetApiRowKey(args: {
  schemaPath?: string
  fieldKey?: string
  portKey?: string
}): string | null {
  const normalizedCandidates = [
    String(args.schemaPath || '').trim().replace(/^properties\./, ''),
    String(args.fieldKey || '').trim(),
    String(args.portKey || '').trim(),
  ].filter(Boolean)
  for (const candidate of normalizedCandidates) {
    const matched = GRABMAPS_DISCOVERY_FIELD_META.find(field => field.propertyKey === candidate)
    if (matched) return matched.mapsRowKey
  }
  return null
}

const MAPS_API_DOC_ROW_BY_KEY = new Map<string, GrabMapsApiDocRow>(
  GRABMAPS_DOC_ROWS.map(row => [String(row.key || '').trim(), row] as const),
)

export function getMapsApiDocRowByRowKey(rowKey: string): GrabMapsApiDocRow | null {
  return MAPS_API_DOC_ROW_BY_KEY.get(String(rowKey || '').trim()) || null
}

export const MAPS_API_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> = GRABMAPS_DOC_ROWS.map(row => ({
  meta: {
    key: `maps.${row.key}`,
    type: toBaseType(row.typeLabel),
    source: 'env',
    read: () => row.value,
  },
  value: row.value,
  valueKey: row.valueKey,
  typeLabel: row.typeLabel,
  tooltipRole: row.valueKey ? GRABMAPS_TOOLTIP_ROLE : undefined,
  tooltipActions: row.valueKey ? GRABMAPS_KEY_ACTIONS_BY_VALUE_KEY[row.valueKey] : undefined,
  tooltipDefaultValue: row.tooltipDefaultValue,
  tooltipMin: row.tooltipMin,
  tooltipMax: row.tooltipMax,
  tooltipInterval: row.tooltipInterval,
  tooltipExpansionNote: row.tooltipExpansionNote,
  tooltipContractionNote: row.tooltipContractionNote,
  tooltipImpact: row.tooltipImpact || row.keyDescription,
  searchHints: ['maps', 'grabmaps', row.key, ...(row.searchHints || [])],
  details: {
    area: row.area,
    responsibility: row.keyDescription,
    notes: buildDetailNotes(row),
    modules: row.module,
    classes: row.className,
    functions: row.functionName,
    imports: [],
  } satisfies FlowDetails,
}))
