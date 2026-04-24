import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusChatApiDocs'

export const MAPS_GRABMAPS_MCP_DOC_AREA = 'GrabMaps MCP Configuration'

type GrabMapsMcpDocRow = {
  key: string
  typeLabel: string
  valueKey: string
  responsibility: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
}

const GRABMAPS_MCP_TOOLTIP_ROLE = 'GrabMaps MCP'

const GRABMAPS_MCP_DOC_ROWS: ReadonlyArray<GrabMapsMcpDocRow> = [
  {
    key: 'server_key',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.serverKey',
    responsibility: 'MCP server key inside the mcpServers object.',
    tooltipDefaultValue: 'grab-maps-playground',
    searchHints: ['mcp_servers', 'server key', 'grab-maps-playground'],
  },
  {
    key: 'command',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.command',
    responsibility: 'Launcher command for the GrabMaps MCP server block.',
    tooltipDefaultValue: 'npx',
    searchHints: ['command', 'npx', 'mcp-remote'],
  },
  {
    key: 'args',
    typeLabel: 'string[]',
    valueKey: 'maps.grabmaps.mcp.args',
    responsibility: 'CLI args array for mcp-remote, including URL, Authorization template, and transport.',
    tooltipDefaultValue: '[\"-y\",\"mcp-remote@latest\",\"https://maps.grab.com/api/v1/mcp\",\"--header\",\"Authorization:${AUTH_HEADER}\",\"--transport\",\"http-only\"]',
    searchHints: ['args', 'mcp-remote', 'http-only', 'authorization:${auth_header}'],
  },
  {
    key: 'env',
    typeLabel: 'object',
    valueKey: 'maps.grabmaps.mcp.env',
    responsibility: 'Environment object passed to the MCP launcher.',
    tooltipDefaultValue: '{"AUTH_HEADER":"Bearer mcp_{TOKEN}"}',
    searchHints: ['env', 'auth_header', 'bearer mcp token'],
    notes: 'AUTH_HEADER is the SSOT for the templated Authorization header.',
  },
  {
    key: 'startup_timeout_ms',
    typeLabel: 'integer',
    valueKey: 'maps.grabmaps.mcp.startupTimeoutMs',
    responsibility: 'MCP process startup timeout in milliseconds.',
    tooltipDefaultValue: 60000,
    searchHints: ['startup timeout', 'startup_timeout_ms'],
  },
  {
    key: 'search_places.query',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.searchPlaces.query',
    responsibility: 'Keyword search text for `/maps/poi/v1/search`; add category-like words to the keyword when needed.',
    tooltipDefaultValue: 'restaurants Marina Bay',
    searchHints: ['search_places', 'query', 'keyword search', '/maps/poi/v1/search'],
  },
  {
    key: 'search_places.country',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.searchPlaces.country',
    responsibility: 'Optional ISO 3166-1 alpha-3 country bias for keyword search.',
    tooltipDefaultValue: 'SGP',
    searchHints: ['search_places', 'country', 'iso 3166-1 alpha-3', 'sgp'],
  },
  {
    key: 'search_places.lat',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.mcp.searchPlaces.lat',
    responsibility: 'Latitude component of the optional `location` bias for keyword search.',
    tooltipDefaultValue: 1.3521,
    searchHints: ['search_places', 'lat'],
  },
  {
    key: 'search_places.lon',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.mcp.searchPlaces.lon',
    responsibility: 'Longitude component of the optional `location` bias for keyword search.',
    tooltipDefaultValue: 103.8198,
    searchHints: ['search_places', 'lon'],
  },
  {
    key: 'search_places.radius',
    typeLabel: 'integer',
    valueKey: 'maps.grabmaps.mcp.searchPlaces.radius',
    responsibility: 'Optional MCP wrapper bias radius; official keyword search primarily uses `keyword`, `country`, `location`, and `limit`.',
    tooltipDefaultValue: 1000,
    searchHints: ['search_places', 'radius'],
    notes: 'Keep this only for MCP-side contextual narrowing; it is not a first-class HTTP keyword-search parameter.',
  },
  {
    key: 'search_places.limit',
    typeLabel: 'integer',
    valueKey: 'maps.grabmaps.mcp.searchPlaces.limit',
    responsibility: 'Maximum number of place results returned by keyword search.',
    tooltipDefaultValue: 10,
    searchHints: ['search_places', 'limit'],
  },
  {
    key: 'get_directions.origin',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.getDirections.origin',
    responsibility: 'Origin string or place label for directions lookup.',
    tooltipDefaultValue: 'Orchard Road',
    searchHints: ['get_directions', 'origin'],
  },
  {
    key: 'get_directions.destination',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.getDirections.destination',
    responsibility: 'Destination string or place label for directions lookup.',
    tooltipDefaultValue: 'Changi Airport',
    searchHints: ['get_directions', 'destination'],
  },
  {
    key: 'get_directions.waypoints',
    typeLabel: 'object[]',
    valueKey: 'maps.grabmaps.mcp.getDirections.waypoints',
    responsibility: 'Optional intermediate stops encoded as JSON array.',
    tooltipDefaultValue: '[]',
    searchHints: ['get_directions', 'waypoints'],
  },
  {
    key: 'nearby_search.lat',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.mcp.nearbySearch.lat',
    responsibility: 'Latitude anchor for nearby search.',
    tooltipDefaultValue: 1.3521,
    searchHints: ['nearby_search', 'lat'],
  },
  {
    key: 'nearby_search.lon',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.mcp.nearbySearch.lon',
    responsibility: 'Longitude anchor for nearby search.',
    tooltipDefaultValue: 103.8198,
    searchHints: ['nearby_search', 'lon'],
  },
  {
    key: 'nearby_search.radius',
    typeLabel: 'integer',
    valueKey: 'maps.grabmaps.mcp.nearbySearch.radius',
    responsibility: 'Nearby search radius in kilometres for `/maps/place/v2/nearby`.',
    tooltipDefaultValue: 1,
    searchHints: ['nearby_search', 'radius'],
    notes: 'The official Nearby Places API uses kilometres, not meters.',
  },
  {
    key: 'nearby_search.limit',
    typeLabel: 'integer',
    valueKey: 'maps.grabmaps.mcp.nearbySearch.limit',
    responsibility: 'Maximum POIs returned by nearby search.',
    tooltipDefaultValue: 10,
    searchHints: ['nearby_search', 'limit'],
  },
  {
    key: 'nearby_search.rankBy',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.nearbySearch.rankBy',
    responsibility: 'Nearby search ranking mode (`distance` or `popularity`).',
    tooltipDefaultValue: 'distance',
    searchHints: ['nearby_search', 'rankBy', 'distance', 'popularity'],
  },
  {
    key: 'nearby_search.language',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.nearbySearch.language',
    responsibility: 'Language for nearby place names.',
    tooltipDefaultValue: 'en',
    searchHints: ['nearby_search', 'language'],
  },
  {
    key: 'nearby_search.category',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.mcp.nearbySearch.category',
    responsibility: 'POI category for nearby_search.',
    tooltipDefaultValue: 'restaurant',
    searchHints: ['nearby_search', 'category'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export const GRABMAPS_MCP_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  GRABMAPS_MCP_DOC_ROWS.map(row => {
    const details: FlowDetails = {
      area: MAPS_GRABMAPS_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['GrabMaps MCP'],
      classes: ['Configuration'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `grabmapsMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: 'backendEnv',
        read: () => 'Integration setting',
      },
      value: 'Integration setting',
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: GRABMAPS_MCP_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: ['grabmaps mcp configuration', row.key, ...(row.searchHints || [])],
      details,
    }
  })
