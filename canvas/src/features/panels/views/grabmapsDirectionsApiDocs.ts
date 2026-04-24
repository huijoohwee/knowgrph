import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusChatApiDocs'

export const MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA = 'GrabMaps Directions Request'

type GrabMapsDirectionsDocRow = {
  key: string
  typeLabel: string
  valueKey: string
  responsibility: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
}

const GRABMAPS_TOOLTIP_ROLE = 'GrabMaps Directions'

const GRABMAPS_DIRECTIONS_DOC_ROWS: ReadonlyArray<GrabMapsDirectionsDocRow> = [
  {
    key: 'endpoint_url',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.directions.endpointUrl',
    responsibility: 'Directions endpoint URL (GrabMaps host is proxied for auth).',
    tooltipDefaultValue: 'https://maps.grab.com/api/v1/maps/eta/v1/direction',
    searchHints: ['direction', 'endpoint', 'eta'],
  },
  {
    key: 'origin_lng',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.directions.originLng',
    responsibility: 'Origin longitude for route requests.',
    tooltipDefaultValue: 103.8198,
    searchHints: ['origin', 'lng'],
  },
  {
    key: 'origin_lat',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.directions.originLat',
    responsibility: 'Origin latitude for route requests.',
    tooltipDefaultValue: 1.3521,
    searchHints: ['origin', 'lat'],
  },
  {
    key: 'destination_lng',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.directions.destinationLng',
    responsibility: 'Destination longitude for route requests.',
    tooltipDefaultValue: 103.851959,
    searchHints: ['destination', 'lng'],
  },
  {
    key: 'destination_lat',
    typeLabel: 'number',
    valueKey: 'maps.grabmaps.directions.destinationLat',
    responsibility: 'Destination latitude for route requests.',
    tooltipDefaultValue: 1.29027,
    searchHints: ['destination', 'lat'],
  },
  {
    key: 'overview',
    typeLabel: 'enum',
    valueKey: 'maps.grabmaps.directions.overview',
    responsibility: 'Route geometry overview level. Use full when you need animation-grade geometry.',
    tooltipDefaultValue: 'full',
    searchHints: ['geometry', 'polyline6', 'overview'],
    notes: 'Geometry detail impacts polyline fidelity.',
  },
  {
    key: 'lat_first',
    typeLabel: 'boolean',
    valueKey: 'maps.grabmaps.directions.latFirst',
    responsibility: 'Coordinate order toggle. Default is lng,lat unless you explicitly opt into lat-first.',
    tooltipDefaultValue: false,
    searchHints: ['lng lat', 'lat_first'],
  },
  {
    key: 'alternatives',
    typeLabel: 'boolean',
    valueKey: 'maps.grabmaps.directions.alternatives',
    responsibility: 'Whether to request alternative routes (if supported by the endpoint).',
    tooltipDefaultValue: false,
    searchHints: ['alternatives'],
  },
  {
    key: 'steps',
    typeLabel: 'boolean',
    valueKey: 'maps.grabmaps.directions.steps',
    responsibility: 'Whether to request per-step instructions (if supported by the endpoint).',
    tooltipDefaultValue: false,
    searchHints: ['steps', 'instructions'],
  },
  {
    key: 'language',
    typeLabel: 'string',
    valueKey: 'maps.grabmaps.directions.language',
    responsibility: 'Language code for instructions (if supported by the endpoint).',
    tooltipDefaultValue: 'en',
    searchHints: ['language'],
  },
  {
    key: 'units',
    typeLabel: 'enum',
    valueKey: 'maps.grabmaps.directions.units',
    responsibility: 'Units preference (if supported by the endpoint).',
    tooltipDefaultValue: 'metric',
    searchHints: ['units', 'metric', 'imperial'],
  },
  {
    key: 'waypoints',
    typeLabel: 'object[]',
    valueKey: 'maps.grabmaps.directions.waypoints',
    responsibility: 'Intermediate stops/waypoints encoded as JSON (shape depends on endpoint).',
    tooltipDefaultValue: '[]',
    searchHints: ['waypoints', 'array'],
  },
  {
    key: 'annotations',
    typeLabel: 'string[]',
    valueKey: 'maps.grabmaps.directions.annotations',
    responsibility: 'Requested annotations encoded as JSON array (shape depends on endpoint).',
    tooltipDefaultValue: '[]',
    searchHints: ['annotations', 'array'],
  },
  {
    key: 'extra_params',
    typeLabel: 'object',
    valueKey: 'maps.grabmaps.directions.extraParams',
    responsibility: 'Additional query/body fields encoded as JSON object for forward-compat.',
    tooltipDefaultValue: '{}',
    searchHints: ['extra params', 'object'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export const GRABMAPS_DIRECTIONS_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  GRABMAPS_DIRECTIONS_DOC_ROWS.map(row => {
    const details: FlowDetails = {
      area: MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['GrabMaps Directions'],
      classes: ['Request'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `grabmapsDirectionsApi.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: 'backendEnv',
        read: () => 'Integration setting',
      },
      value: 'Integration setting',
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: GRABMAPS_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: ['grabmaps directions request parameters', row.key, ...(row.searchHints || [])],
      details,
    }
  })
