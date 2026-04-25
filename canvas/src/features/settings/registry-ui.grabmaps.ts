import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsFloat, lsJson, lsSetFloat, lsSetJson } from '@/lib/persistence'
import { normalizeGrabMapsAuthMode, sanitizeGrabMapsApiKey } from 'grph-shared/geospatial/grabMapsAuth'
import { GRABMAPS_DEFAULT_DIRECTIONS_URL, GRABMAPS_DEFAULT_MCP_URL, GRABMAPS_DEFAULT_STYLE_URL } from 'grph-shared/geospatial/grabMapsSsot'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()
const GRABMAPS_DEFAULT_MCP_SERVER_KEY = 'grab-maps-playground'
const GRABMAPS_DEFAULT_MCP_COMMAND = 'npx'
const GRABMAPS_DEFAULT_MCP_ARGS_JSON = JSON.stringify([
  '-y',
  'mcp-remote@latest',
  GRABMAPS_DEFAULT_MCP_URL,
  '--header',
  'Authorization:${AUTH_HEADER}',
  '--transport',
  'http-only',
], null, 2)
const GRABMAPS_DEFAULT_MCP_ENV_JSON = JSON.stringify({ AUTH_HEADER: 'Bearer mcp_{TOKEN}' }, null, 2)
const GRABMAPS_DEFAULT_MCP_STARTUP_TIMEOUT_MS = 60000

const normalizeString = (value: unknown, fallback = ''): string => {
  const next = typeof value === 'string' ? value.trim() : ''
  return next || fallback
}

const normalizeJsonText = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback
}

const localStringSetting = (args: {
  key: string
  storageKey: string
  defaultValue: string
  docKey?: string
  options?: string[]
}): SettingMeta => ({
  key: args.key,
  type: 'string',
  source: 'localStorage',
  read: () => lsJson<string>(args.storageKey, args.defaultValue, value => normalizeString(value, args.defaultValue)),
  write: value => {
    const next = args.options?.length
      ? (args.options.includes(String(value ?? '').trim()) ? String(value ?? '').trim() : args.defaultValue)
      : normalizeString(value, args.defaultValue)
    lsSetJson(args.storageKey, next)
  },
  default: () => args.defaultValue,
  options: args.options,
  docKey: args.docKey,
})

const localJsonSetting = (args: {
  key: string
  storageKey: string
  defaultValue: string
  docKey?: string
}): SettingMeta => ({
  key: args.key,
  type: 'json',
  source: 'localStorage',
  read: () => lsJson<string>(args.storageKey, args.defaultValue, value => normalizeJsonText(value, args.defaultValue)),
  write: value => {
    lsSetJson(args.storageKey, typeof value === 'string' ? value : args.defaultValue)
  },
  default: () => args.defaultValue,
  docKey: args.docKey,
})

const localNumberSetting = (args: {
  key: string
  storageKey: string
  defaultValue: number
  min?: number
  max?: number
  docKey?: string
}): SettingMeta => ({
  key: args.key,
  type: 'number',
  source: 'localStorage',
  read: () => lsFloat(args.storageKey, args.defaultValue, {
    ...(typeof args.min === 'number' ? { min: args.min } : {}),
    ...(typeof args.max === 'number' ? { max: args.max } : {}),
  }),
  write: value => {
    lsSetFloat(args.storageKey, Number(value), {
      ...(typeof args.min === 'number' ? { min: args.min } : {}),
      ...(typeof args.max === 'number' ? { max: args.max } : {}),
    })
  },
  default: () => args.defaultValue,
  docKey: args.docKey,
})

export const uiGrabMapsSettingsRegistry: SettingMeta[] = [
  {
    key: 'maps.grabmaps.authMode',
    type: 'string',
    source: 'store',
    read: () => s().grabMapsAuthMode,
    write: v => s().setGrabMapsAuthMode(normalizeGrabMapsAuthMode(v)),
    default: () => 'byok',
    options: ['byok', 'serverManaged'],
    docKey: 'maps.grabmaps.authMode',
  },
  {
    key: 'maps.grabmaps.apiKey',
    type: 'string',
    source: 'store',
    read: () => s().grabMapsApiKey,
    write: v => s().setGrabMapsApiKey(sanitizeGrabMapsApiKey(v)),
    default: () => '',
    docKey: 'maps.grabmaps.apiKey',
  },
  {
    key: 'maps.grabmaps.directions.endpointUrl',
    type: 'string',
    source: 'store',
    read: () => s().grabMapsDirectionsEndpointUrl,
    write: v => s().setGrabMapsDirectionsEndpointUrl(String(v ?? '')),
    default: () => GRABMAPS_DEFAULT_DIRECTIONS_URL,
    docKey: 'maps.grabmaps.directions.endpointUrl',
  },
  {
    key: 'maps.grabmaps.directions.originLng',
    type: 'number',
    source: 'store',
    read: () => s().grabMapsDirectionsOriginLng,
    write: v => s().setGrabMapsDirectionsOriginLng(Number(v)),
    default: () => 103.8198,
    docKey: 'maps.grabmaps.directions.originLng',
  },
  {
    key: 'maps.grabmaps.directions.originLat',
    type: 'number',
    source: 'store',
    read: () => s().grabMapsDirectionsOriginLat,
    write: v => s().setGrabMapsDirectionsOriginLat(Number(v)),
    default: () => 1.3521,
    docKey: 'maps.grabmaps.directions.originLat',
  },
  {
    key: 'maps.grabmaps.directions.destinationLng',
    type: 'number',
    source: 'store',
    read: () => s().grabMapsDirectionsDestinationLng,
    write: v => s().setGrabMapsDirectionsDestinationLng(Number(v)),
    default: () => 103.851959,
    docKey: 'maps.grabmaps.directions.destinationLng',
  },
  {
    key: 'maps.grabmaps.directions.destinationLat',
    type: 'number',
    source: 'store',
    read: () => s().grabMapsDirectionsDestinationLat,
    write: v => s().setGrabMapsDirectionsDestinationLat(Number(v)),
    default: () => 1.29027,
    docKey: 'maps.grabmaps.directions.destinationLat',
  },
  {
    key: 'maps.grabmaps.directions.overview',
    type: 'string',
    source: 'store',
    read: () => s().grabMapsDirectionsOverview,
    write: v => s().setGrabMapsDirectionsOverview(String(v ?? '')),
    default: () => 'full',
    options: ['full', 'simplified'],
    docKey: 'maps.grabmaps.directions.overview',
  },
  {
    key: 'maps.grabmaps.directions.latFirst',
    type: 'boolean',
    source: 'store',
    read: () => s().grabMapsDirectionsLatFirst,
    write: v => s().setGrabMapsDirectionsLatFirst(Boolean(v)),
    default: () => false,
    docKey: 'maps.grabmaps.directions.latFirst',
  },
  {
    key: 'maps.grabmaps.directions.alternatives',
    type: 'boolean',
    source: 'store',
    read: () => s().grabMapsDirectionsAlternatives,
    write: v => s().setGrabMapsDirectionsAlternatives(Boolean(v)),
    default: () => false,
    docKey: 'maps.grabmaps.directions.alternatives',
  },
  {
    key: 'maps.grabmaps.directions.steps',
    type: 'boolean',
    source: 'store',
    read: () => s().grabMapsDirectionsSteps,
    write: v => s().setGrabMapsDirectionsSteps(Boolean(v)),
    default: () => false,
    docKey: 'maps.grabmaps.directions.steps',
  },
  {
    key: 'maps.grabmaps.directions.language',
    type: 'string',
    source: 'store',
    read: () => s().grabMapsDirectionsLanguage,
    write: v => s().setGrabMapsDirectionsLanguage(String(v ?? '')),
    default: () => 'en',
    docKey: 'maps.grabmaps.directions.language',
  },
  {
    key: 'maps.grabmaps.directions.units',
    type: 'string',
    source: 'store',
    read: () => s().grabMapsDirectionsUnits,
    write: v => s().setGrabMapsDirectionsUnits(String(v ?? '')),
    default: () => 'metric',
    options: ['metric', 'imperial'],
    docKey: 'maps.grabmaps.directions.units',
  },
  {
    key: 'maps.grabmaps.directions.waypoints',
    type: 'json',
    source: 'store',
    read: () => s().grabMapsDirectionsWaypointsJson,
    write: v => s().setGrabMapsDirectionsWaypointsJson(String(v ?? '')),
    default: () => '[]',
    docKey: 'maps.grabmaps.directions.waypoints',
  },
  {
    key: 'maps.grabmaps.directions.annotations',
    type: 'json',
    source: 'store',
    read: () => s().grabMapsDirectionsAnnotationsJson,
    write: v => s().setGrabMapsDirectionsAnnotationsJson(String(v ?? '')),
    default: () => '[]',
    docKey: 'maps.grabmaps.directions.annotations',
  },
  {
    key: 'maps.grabmaps.directions.extraParams',
    type: 'json',
    source: 'store',
    read: () => s().grabMapsDirectionsExtraParamsJson,
    write: v => s().setGrabMapsDirectionsExtraParamsJson(String(v ?? '')),
    default: () => '{}',
    docKey: 'maps.grabmaps.directions.extraParams',
  },
  {
    key: 'maps.grabmaps.basemap.styleUrl',
    type: 'string',
    source: 'store',
    read: () => s().grabMapsBasemapStyleUrl,
    write: v => s().setGrabMapsBasemapStyleUrl(String(v ?? '')),
    default: () => GRABMAPS_DEFAULT_STYLE_URL,
    docKey: 'maps.grabmaps.basemap.styleUrl',
  },
  localStringSetting({
    key: 'maps.grabmaps.mcp.serverKey',
    storageKey: LS_KEYS.grabMapsMcpServerKey,
    defaultValue: GRABMAPS_DEFAULT_MCP_SERVER_KEY,
    docKey: 'maps.grabmaps.mcp.serverKey',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.command',
    storageKey: LS_KEYS.grabMapsMcpCommand,
    defaultValue: GRABMAPS_DEFAULT_MCP_COMMAND,
    docKey: 'maps.grabmaps.mcp.command',
  }),
  localJsonSetting({
    key: 'maps.grabmaps.mcp.args',
    storageKey: LS_KEYS.grabMapsMcpArgsJson,
    defaultValue: GRABMAPS_DEFAULT_MCP_ARGS_JSON,
    docKey: 'maps.grabmaps.mcp.args',
  }),
  localJsonSetting({
    key: 'maps.grabmaps.mcp.env',
    storageKey: LS_KEYS.grabMapsMcpEnvJson,
    defaultValue: GRABMAPS_DEFAULT_MCP_ENV_JSON,
    docKey: 'maps.grabmaps.mcp.env',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.startupTimeoutMs',
    storageKey: LS_KEYS.grabMapsMcpStartupTimeoutMs,
    defaultValue: GRABMAPS_DEFAULT_MCP_STARTUP_TIMEOUT_MS,
    min: 1000,
    max: 300000,
    docKey: 'maps.grabmaps.mcp.startupTimeoutMs',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.discovery.chatModel',
    storageKey: LS_KEYS.grabMapsMcpDiscoveryChatModel,
    defaultValue: 'gpt-5.4-nano',
    options: ['gpt-5.4-nano'],
    docKey: 'maps.grabmaps.mcp.discovery.chatModel',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.searchPlaces.query',
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesQuery,
    defaultValue: 'restaurants Marina Bay',
    docKey: 'maps.grabmaps.mcp.searchPlaces.query',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.searchPlaces.country',
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesCountry,
    defaultValue: 'SGP',
    docKey: 'maps.grabmaps.mcp.searchPlaces.country',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.searchPlaces.lat',
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesLat,
    defaultValue: 1.3521,
    min: -90,
    max: 90,
    docKey: 'maps.grabmaps.mcp.searchPlaces.lat',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.searchPlaces.lon',
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesLon,
    defaultValue: 103.8198,
    min: -180,
    max: 180,
    docKey: 'maps.grabmaps.mcp.searchPlaces.lon',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.searchPlaces.radius',
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesRadius,
    defaultValue: 1000,
    min: 0,
    max: 50000,
    docKey: 'maps.grabmaps.mcp.searchPlaces.radius',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.searchPlaces.limit',
    storageKey: LS_KEYS.grabMapsMcpSearchPlacesLimit,
    defaultValue: 10,
    min: 1,
    max: 50,
    docKey: 'maps.grabmaps.mcp.searchPlaces.limit',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.getDirections.origin',
    storageKey: LS_KEYS.grabMapsMcpGetDirectionsOrigin,
    defaultValue: 'Orchard Road',
    docKey: 'maps.grabmaps.mcp.getDirections.origin',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.getDirections.destination',
    storageKey: LS_KEYS.grabMapsMcpGetDirectionsDestination,
    defaultValue: 'Changi Airport',
    docKey: 'maps.grabmaps.mcp.getDirections.destination',
  }),
  localJsonSetting({
    key: 'maps.grabmaps.mcp.getDirections.waypoints',
    storageKey: LS_KEYS.grabMapsMcpGetDirectionsWaypointsJson,
    defaultValue: '[]',
    docKey: 'maps.grabmaps.mcp.getDirections.waypoints',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.nearbySearch.lat',
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLat,
    defaultValue: 1.3521,
    min: -90,
    max: 90,
    docKey: 'maps.grabmaps.mcp.nearbySearch.lat',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.nearbySearch.lon',
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLon,
    defaultValue: 103.8198,
    min: -180,
    max: 180,
    docKey: 'maps.grabmaps.mcp.nearbySearch.lon',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.nearbySearch.radius',
    storageKey: LS_KEYS.grabMapsMcpNearbySearchRadius,
    defaultValue: 1,
    min: 0,
    max: 50,
    docKey: 'maps.grabmaps.mcp.nearbySearch.radius',
  }),
  localNumberSetting({
    key: 'maps.grabmaps.mcp.nearbySearch.limit',
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLimit,
    defaultValue: 10,
    min: 1,
    max: 50,
    docKey: 'maps.grabmaps.mcp.nearbySearch.limit',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.nearbySearch.rankBy',
    storageKey: LS_KEYS.grabMapsMcpNearbySearchRankBy,
    defaultValue: 'distance',
    docKey: 'maps.grabmaps.mcp.nearbySearch.rankBy',
    options: ['distance', 'popularity'],
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.nearbySearch.language',
    storageKey: LS_KEYS.grabMapsMcpNearbySearchLanguage,
    defaultValue: 'en',
    docKey: 'maps.grabmaps.mcp.nearbySearch.language',
  }),
  localStringSetting({
    key: 'maps.grabmaps.mcp.nearbySearch.category',
    storageKey: LS_KEYS.grabMapsMcpNearbySearchCategory,
    defaultValue: 'restaurant',
    docKey: 'maps.grabmaps.mcp.nearbySearch.category',
  }),
]
