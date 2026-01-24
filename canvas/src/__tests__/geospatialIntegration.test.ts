import { loadDatasetFeatureCollection } from '@/features/geospatial/geospatialOverlayUtils'
import { LRUCache } from '@/lib/cache/LRUCache'
import type { FeatureCollection } from 'geojson'

const MOCK_AIRPORTS = {
  "AAA": {
    "icao": "NTGA",
    "iata": "AAA",
    "name": "Anaa Airport",
    "lat": -17.3526001,
    "lon": -145.5099945
  },
  "JFK": {
    "icao": "KJFK",
    "iata": "JFK",
    "name": "John F Kennedy International Airport",
    "lat": 40.63980103,
    "lon": -73.77890015
  }
}

const MOCK_COUNTRIES = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Test Country" },
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]
      }
    }
  ]
}

const mockFetcher = async (url: string): Promise<string | null> => {
  if (url.includes('airports.json')) return JSON.stringify(MOCK_AIRPORTS)
  if (url.includes('countries.geojson')) return JSON.stringify(MOCK_COUNTRIES)
  if (url.includes('cities.geojson')) {
    return JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Mock City" },
          geometry: { type: "Point", coordinates: [0, 0] }
        }
      ]
    })
  }
  return null
}

export async function testGeospatialIntegrationAirports() {
  const cache = new LRUCache<string, FeatureCollection>(10, 1000)
  const result = await loadDatasetFeatureCollection(
    'https://example.com/airports.json',
    'auto',
    { timeoutMs: 1000, maxBytes: 10000 },
    cache,
    mockFetcher
  )
  
  if (!result) throw new Error('Result is null')
  if (result.type !== 'FeatureCollection') throw new Error('Result is not FeatureCollection')
  if (result.features.length !== 2) throw new Error(`Expected 2 features, got ${result.features.length}`)
  
  const jfk = result.features.find(f => f.properties?.iata === 'JFK')
  if (!jfk) throw new Error('JFK feature not found')
  if (jfk.geometry.type !== 'Point') throw new Error('JFK is not a Point')
  
  const coords = jfk.geometry.coordinates
  if (coords.length < 2) throw new Error('JFK coordinates missing lng/lat')
  if (Math.abs(coords[0] - (-73.7789)) > 0.001) throw new Error(`JFK Lng mismatch: ${coords[0]}`)
  if (Math.abs(coords[1] - 40.6398) > 0.001) throw new Error(`JFK Lat mismatch: ${coords[1]}`)
}

export async function testGeospatialIntegrationCountries() {
  const cache = new LRUCache<string, FeatureCollection>(10, 1000)
  const result = await loadDatasetFeatureCollection(
    'https://example.com/countries.geojson',
    'auto',
    { timeoutMs: 1000, maxBytes: 10000 },
    cache,
    mockFetcher
  )
  
  if (!result) throw new Error('Result is null')
  if (result.features.length !== 1) throw new Error('Expected 1 feature')
  if (result.features[0].geometry.type !== 'Polygon') throw new Error('Expected Polygon')
}

export async function testGeospatialIntegrationCities() {
    const cache = new LRUCache<string, FeatureCollection>(10, 1000)
    // We use a fake path, mockFetcher handles it by string matching
    const result = await loadDatasetFeatureCollection(
      '/path/to/cities.geojson',
      'auto',
      { timeoutMs: 1000, maxBytes: 10000 },
      cache,
      mockFetcher
    )
    if (!result) throw new Error('Result is null')
    if (result.features.length === 0) throw new Error('Expected features')
}
