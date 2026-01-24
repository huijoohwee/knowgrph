import { loadDatasetFeatureCollection } from '@/features/geospatial/geospatialOverlayUtils'
import { LRUCache } from '@/lib/cache/LRUCache'
import type { FeatureCollection } from 'geojson'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createFsBoundedTextFetcher } from '@/__tests__/testUtils/fsBoundedTextFetcher'

type RegistryItem = {
  id: string
  label: string
  url: string
  format: 'auto' | 'geojson' | 'records'
  fixturePath: string
  expectTooLarge?: boolean
}

const readRegistry = (): RegistryItem[] => {
  const path = resolve(process.cwd(), 'src/__tests__/demo/geospatial-datasets.layers.json')
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!Array.isArray(raw)) throw new Error('geospatial dataset registry is not an array')
  return raw as RegistryItem[]
}

const getRegistryItem = (id: string): RegistryItem => {
  const items = readRegistry()
  const found = items.find(i => i && i.id === id)
  if (!found) throw new Error(`missing registry item: ${id}`)
  return found
}

const createFetcherForRegistry = (items: RegistryItem[]) => {
  const baseDir = resolve(process.cwd(), 'src/__tests__/demo')
  return createFsBoundedTextFetcher({
    baseDir,
    registry: items.map(i => ({ url: i.url, fixturePath: i.fixturePath })),
  })
}

export async function testGeospatialIntegrationAirports() {
  const item = getRegistryItem('layer-01')
  const fetcher = createFetcherForRegistry([item])
  const cache = new LRUCache<string, FeatureCollection>(10, 1000)
  const result = await loadDatasetFeatureCollection(
    item.url,
    item.format,
    { timeoutMs: 1000, maxBytes: 256 * 1024 },
    cache,
    fetcher
  )
  
  if (!result) throw new Error('Result is null')
  if (result.type !== 'FeatureCollection') throw new Error('Result is not FeatureCollection')
  if (result.features.length !== 2) throw new Error(`Expected 2 features, got ${result.features.length}`)
  
  const a = result.features.find(f => f.properties?.icao === '00AK')
  if (!a) throw new Error('00AK feature not found')
  if (a.geometry.type !== 'Point') throw new Error('00AK is not a Point')
}

export async function testGeospatialIntegrationCountries() {
  const item = getRegistryItem('layer-02')
  const fetcher = createFetcherForRegistry([item])
  const cache = new LRUCache<string, FeatureCollection>(10, 1000)
  const result = await loadDatasetFeatureCollection(
    item.url,
    item.format,
    { timeoutMs: 1000, maxBytes: 256 * 1024 },
    cache,
    fetcher
  )
  
  if (!result) throw new Error('Result is null')
  if (result.features.length !== 1) throw new Error('Expected 1 feature')
  if (result.features[0].geometry.type !== 'Polygon') throw new Error('Expected Polygon')
}

export async function testGeospatialIntegrationCities() {
  const layer03 = getRegistryItem('layer-03')
  const layer04 = getRegistryItem('layer-04')
  const fetcher = createFetcherForRegistry([layer03, layer04])

  {
    const cache = new LRUCache<string, FeatureCollection>(10, 1000)
    const result = await loadDatasetFeatureCollection(
      layer03.url,
      layer03.format,
      { timeoutMs: 1500, maxBytes: 8 * 1024 * 1024 },
      cache,
      fetcher,
    )
    if (!result) throw new Error('Layer 03 result is null')
    if (result.features.length === 0) throw new Error('Expected features for layer 03')
  }

  {
    const cache = new LRUCache<string, FeatureCollection>(10, 1000)
    let threw = false
    try {
      await loadDatasetFeatureCollection(
        layer04.url,
        layer04.format,
        { timeoutMs: 200, maxBytes: 4 * 1024 * 1024 },
        cache,
        fetcher,
      )
    } catch {
      threw = true
    }
    if (!threw) throw new Error('Expected layer 04 to fail bounded fetch')
  }
}
