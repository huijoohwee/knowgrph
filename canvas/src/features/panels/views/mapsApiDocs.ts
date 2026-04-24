import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusChatApiDocs'

export const MAPS_GEO_DOC_AREA = 'Geo'
export const MAPS_MAPLIBRE_DOC_AREA = 'MapLibre'
export const MAPS_GRABMAPS_DOC_AREA = 'GrabMaps'

export function getMapsApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `maps-row-${normalized || 'entry'}`
}

type MapsDocRow = {
  key: string
  typeLabel: string
  value: string
  responsibility: string
  area: string
  valueKey?: string
  modules?: string[]
  notes?: string
  searchHints?: string[]
}

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  return 'string'
}

const MAPS_DOC_ROWS: ReadonlyArray<MapsDocRow> = [
  {
    area: MAPS_GRABMAPS_DOC_AREA,
    key: 'grabmaps.docs',
    typeLabel: 'url',
    value: 'https://maps.grab.com/developer/documentation',
    responsibility: 'GrabMaps developer documentation (builder-first + MapLibre parity).',
    searchHints: ['grabmaps docs', 'builder', 'maplibre'],
  },
  {
    area: MAPS_GRABMAPS_DOC_AREA,
    key: 'grabmaps.auth_mode',
    typeLabel: 'enum',
    value: 'Integration setting',
    valueKey: 'maps.grabmaps.authMode',
    responsibility: 'GrabMaps auth flow used by proxy-backed style and directions requests.',
    searchHints: ['auth mode', 'byok', 'server-managed'],
  },
  {
    area: MAPS_GRABMAPS_DOC_AREA,
    key: 'grabmaps.api_key',
    typeLabel: 'string',
    value: 'Integration setting',
    valueKey: 'maps.grabmaps.apiKey',
    responsibility: 'BYOK GrabMaps API key used for proxied browser requests.',
    searchHints: ['api key', 'byok', 'authorization'],
    notes: 'Leave empty when auth_mode=serverManaged. Raw tokens and Bearer/Authorization-prefixed values are normalized before proxy use.',
  },
  {
    area: MAPS_GRABMAPS_DOC_AREA,
    key: 'grabmaps.basemap_style_url',
    typeLabel: 'string',
    value: 'Integration setting',
    valueKey: 'maps.grabmaps.basemap.styleUrl',
    responsibility: 'Preferred GrabMaps style.json URL used by the GrabMaps preset and basemap fallback recovery.',
    searchHints: ['style.json', 'basemap', 'theme=light'],
  },
  {
    area: MAPS_GRABMAPS_DOC_AREA,
    key: 'grabmaps.map_rendering_adapters',
    typeLabel: 'policy',
    value: 'MapLibre default; GrabMaps Library fallback',
    responsibility: 'Map rendering adapter SSOT: mount MapLibre GL JS first, then fall back to GrabMaps Library when MapLibre cannot initialize and BYOK key is configured.',
    modules: ['grph-shared/src/geospatial/grabMapsLibrary.ts', 'grph-shared/src/geospatial/grabMapsSsot.ts', 'gympgrph/src/features/geospatial/useMapLibreBasemap.ts'],
    searchHints: ['adapter policy', 'maplibre default', 'grabmaps library fallback'],
  },
  {
    area: MAPS_GRABMAPS_DOC_AREA,
    key: 'grabmaps.attribution',
    typeLabel: 'string',
    value: '© Grab | © OpenStreetMap contributors',
    responsibility: 'Required attribution when rendering GrabMaps tiles.',
    searchHints: ['attribution', 'osm', 'openstreetmap'],
  },
  {
    area: MAPS_GEO_DOC_AREA,
    key: 'geo.panel',
    typeLabel: 'panel',
    value: 'SidePanel → Geo',
    responsibility: 'Opens the Geo floating panel to browse datasets and map output.',
    modules: ['canvas/src/features/geospatial/geoIndex.ts'],
    searchHints: ['floating panel geo', 'side panel geo', 'geospatial panel'],
  },
  {
    area: MAPS_GEO_DOC_AREA,
    key: 'geospatial.mode',
    typeLabel: 'toggle',
    value: 'Enable Geospatial Mode',
    responsibility: 'Enables the geospatial overlay host and swaps graph canvas rendering to maps.',
    modules: ['canvas/src/features/toolbar/hooks/useToolbarActions.ts', 'canvas/src/pages/Canvas.tsx'],
    searchHints: ['geospatial mode', 'overlay host', 'toggle'],
  },
  {
    area: MAPS_GEO_DOC_AREA,
    key: 'geospatial.autoEnableOnImport',
    typeLabel: 'boolean',
    value: 'autoEnableGeospatialOnGeoImport',
    responsibility: 'Auto-enable Geospatial Mode when importing GeoJSON/GeoData.',
    modules: ['canvas/src/features/geospatial/autoEnable.ts', 'canvas/src/features/settings/registry-ui.import-geo.ts'],
    searchHints: ['geo import', 'auto enable'],
  },
  {
    area: MAPS_MAPLIBRE_DOC_AREA,
    key: 'maplibre.basemap.2d',
    typeLabel: 'map',
    value: 'MapLibre Modern 2D',
    responsibility: 'Renders datasets and projected graph features on a MapLibre 2D basemap.',
    modules: ['gympgrph/src/GeospatialHost.tsx'],
    searchHints: ['maplibre', '2d basemap', 'modern'],
  },
  {
    area: MAPS_MAPLIBRE_DOC_AREA,
    key: 'maplibre.basemap.3d',
    typeLabel: 'map',
    value: 'MapLibre Globe',
    responsibility: 'Uses MapLibre globe projection for 3D geospatial view modes.',
    modules: ['gympgrph/src/GeospatialHost.tsx'],
    searchHints: ['maplibre', 'globe', '3d'],
  },
  {
    area: MAPS_MAPLIBRE_DOC_AREA,
    key: 'maplibre.docs',
    typeLabel: 'url',
    value: 'https://maplibre.org/maplibre-gl-js/docs/',
    responsibility: 'MapLibre GL JS reference for styles, sources, and map events.',
    modules: ['maplibre-gl'],
    notes: 'Use the Geo panel to switch between SVG fallback and MapLibre-based view modes.',
    searchHints: ['maplibre docs', 'styles', 'sources'],
  },
]

export const MAPS_API_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> = MAPS_DOC_ROWS.map((row) => {
  const details: FlowDetails = {
    area: row.area,
    responsibility: row.responsibility,
    notes: row.notes || '',
    modules: row.modules || [],
    classes: [],
    functions: [],
    imports: [],
  }
  return {
    meta: {
      key: `maps.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'env',
      read: () => row.value,
    },
    value: row.value,
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    searchHints: ['maps', 'geospatial', ...(row.searchHints || []), row.key],
    details,
  }
})
