import { LS_KEYS, parseGeoJsonFromText } from 'gympgrph'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import {
  readTripDemo,
  readTripDemoMmd,
  resolveTripDemoDocumentPath,
  resolveTripDemoMmdDocumentPath,
} from '@/tests/lib/tripDemo'
import type { GraphData } from '@/lib/graph/types'

const extractFirstGeoJsonFromJsonFences = (markdown: string): string | null => {
  const lines = String(markdown || '').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const open = String(lines[i] || '').trim().toLowerCase()
    if (open !== '```json') continue
    const buf: string[] = []
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = String(lines[j] || '')
      if (line.trim().startsWith('```')) break
      buf.push(line)
    }
    const text = buf.join('\n').trim()
    if (!text) continue
    try {
      const fc = parseGeoJsonFromText(text)
      if (fc) return text
    } catch {
      void 0
    }
  }
  return null
}

export async function testMarkdownTripDemoJsonFenceRegistersAsGeoDataset() {
  const raw = readTripDemo()
  if (!raw) return
  const docPath = resolveTripDemoDocumentPath() || 'trip-demo.md'

  const geojsonInJsonFence = extractFirstGeoJsonFromJsonFences(raw)
  if (!geojsonInJsonFence) {
    throw new Error('Expected trip demo to include a JSON fence containing a GeoJSON FeatureCollection')
  }

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch

  try {
    ;(globalThis as unknown as { fetch: unknown }).fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, url: '/__geo_local/test.geojson', name: 'trip-demo-L1.geojson' }),
      } as unknown as Response
    }

    const integration = createMarkdownGeoDatasetIntegration()
    const req = {
      sourceDocumentPath: docPath,
      codeBlock: {
        lang: 'json' as const,
        text: geojsonInJsonFence,
        startLine: 1,
        endLine: 1,
      },
    }

    if (!integration.isGeoJsonCodeBlock?.(req)) return

    const res = await integration.registerGeoJsonFeatureCollection?.(req)
    if (!res || res.ok !== true) {
      throw new Error(`Expected registerGeoJsonFeatureCollection to succeed, got ${JSON.stringify(res)}`)
    }

    const stored = storage.getItem(LS_KEYS.geospatialDatasets)
    const parsed = stored ? (JSON.parse(stored) as unknown) : null
    if (!Array.isArray(parsed)) {
      throw new Error('Expected geospatial datasets to be written to localStorage')
    }
    const has = parsed.some(item => {
      if (!item || typeof item !== 'object') return false
      const rec = item as Record<string, unknown>
      const source = rec.source as Record<string, unknown> | null
      if (!source || source.kind !== 'url') return false
      return String(source.url || '') === '/__geo_local/test.geojson'
    })
    if (!has) {
      throw new Error('Expected registered dataset URL to appear in geospatialDatasets')
    }
  } finally {
    if (typeof originalFetch === 'undefined') {
      delete (globalThis as unknown as { fetch?: unknown }).fetch
    } else {
      ;(globalThis as unknown as { fetch?: unknown }).fetch = originalFetch
    }
    restoreWindow()
  }
}

export async function testMarkdownTripDemoJsonFenceLoadsGraphData() {
  const raw = readTripDemo()
  if (!raw) return
  const docPath = resolveTripDemoDocumentPath() || 'trip-demo.md'

  const geojsonInJsonFence = extractFirstGeoJsonFromJsonFences(raw)
  if (!geojsonInJsonFence) {
    throw new Error('Expected trip demo to include a JSON fence containing a GeoJSON FeatureCollection')
  }

  let loadedGraph: GraphData | null = null
  const integration = createMarkdownGeoDatasetIntegration({
    loadGraphData: graphData => {
      loadedGraph = graphData
    },
  })
  const req = {
    sourceDocumentPath: docPath,
    codeBlock: {
      lang: 'json' as const,
      text: geojsonInJsonFence,
      startLine: 1,
      endLine: 1,
    },
  }

  if (!integration.isGeoJsonCodeBlock?.(req)) return

  const res = await integration.loadGeoJsonAsGraphData?.(req)
  if (!res || res.ok !== true) {
    throw new Error(`Expected loadGeoJsonAsGraphData to succeed, got ${JSON.stringify(res)}`)
  }
  if (!loadedGraph || loadedGraph.type !== 'Graph') {
    throw new Error('Expected loadGeoJsonAsGraphData to call loadGraphData with a GraphData')
  }
  if (!Array.isArray(loadedGraph.nodes) || loadedGraph.nodes.length === 0) {
    throw new Error('Expected GraphData nodes from GeoJSON conversion')
  }

  const hasGeo = loadedGraph.nodes.some(n => {
    if (!n || typeof n !== 'object') return false
    const rec = n as unknown as { properties?: unknown }
    const props = rec.properties as Record<string, unknown> | null
    if (!props || typeof props !== 'object') return false
    const geo = props.geo as Record<string, unknown> | null
    if (!geo || typeof geo !== 'object') return false
    return Number.isFinite(geo.lat) && Number.isFinite(geo.lng)
  })
  if (!hasGeo) {
    throw new Error('Expected at least one node to have properties.geo.{lat,lng}')
  }
}

export async function testMarkdownTripDemoMmdJsonFenceRegistersAsGeoDataset() {
  const raw = readTripDemoMmd()
  if (!raw) return
  const docPath = resolveTripDemoMmdDocumentPath() || 'trip-demo-mmd.md'

  const geojsonInJsonFence = extractFirstGeoJsonFromJsonFences(raw)
  if (!geojsonInJsonFence) {
    throw new Error('Expected trip-demo-mmd.md to include a JSON fence containing a GeoJSON FeatureCollection')
  }

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch

  try {
    ;(globalThis as unknown as { fetch: unknown }).fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, url: '/__geo_local/test.geojson', name: 'trip-demo-mmd-L1.geojson' }),
      } as unknown as Response
    }

    const integration = createMarkdownGeoDatasetIntegration()
    const req = {
      sourceDocumentPath: docPath,
      codeBlock: {
        lang: 'json' as const,
        text: geojsonInJsonFence,
        startLine: 1,
        endLine: 1,
      },
    }

    if (!integration.isGeoJsonCodeBlock?.(req)) return

    const res = await integration.registerGeoJsonFeatureCollection?.(req)
    if (!res || res.ok !== true) {
      throw new Error(`Expected registerGeoJsonFeatureCollection to succeed, got ${JSON.stringify(res)}`)
    }
  } finally {
    if (typeof originalFetch === 'undefined') {
      delete (globalThis as unknown as { fetch?: unknown }).fetch
    } else {
      ;(globalThis as unknown as { fetch?: unknown }).fetch = originalFetch
    }
    restoreWindow()
  }
}

export async function testMarkdownTripDemoMmdJsonFenceLoadsGraphData() {
  const raw = readTripDemoMmd()
  if (!raw) return
  const docPath = resolveTripDemoMmdDocumentPath() || 'trip-demo-mmd.md'

  const geojsonInJsonFence = extractFirstGeoJsonFromJsonFences(raw)
  if (!geojsonInJsonFence) {
    throw new Error('Expected trip-demo-mmd.md to include a JSON fence containing a GeoJSON FeatureCollection')
  }

  let loadedGraph: GraphData | null = null
  const integration = createMarkdownGeoDatasetIntegration({
    loadGraphData: graphData => {
      loadedGraph = graphData
    },
  })
  const req = {
    sourceDocumentPath: docPath,
    codeBlock: {
      lang: 'json' as const,
      text: geojsonInJsonFence,
      startLine: 1,
      endLine: 1,
    },
  }

  if (!integration.isGeoJsonCodeBlock?.(req)) return

  const res = await integration.loadGeoJsonAsGraphData?.(req)
  if (!res || res.ok !== true) {
    throw new Error(`Expected loadGeoJsonAsGraphData to succeed, got ${JSON.stringify(res)}`)
  }
  if (!loadedGraph || loadedGraph.type !== 'Graph') {
    throw new Error('Expected loadGeoJsonAsGraphData to call loadGraphData with a GraphData')
  }
  if (!Array.isArray(loadedGraph.nodes) || loadedGraph.nodes.length === 0) {
    throw new Error('Expected GraphData nodes from GeoJSON conversion')
  }

  const hasGeo = loadedGraph.nodes.some(n => {
    if (!n || typeof n !== 'object') return false
    const rec = n as unknown as { properties?: unknown }
    const props = rec.properties as Record<string, unknown> | null
    if (!props || typeof props !== 'object') return false
    const geo = props.geo as Record<string, unknown> | null
    if (!geo || typeof geo !== 'object') return false
    return Number.isFinite(geo.lat) && Number.isFinite(geo.lng)
  })
  if (!hasGeo) {
    throw new Error('Expected at least one node to have properties.geo.{lat,lng}')
  }
}
