import fs from 'node:fs'
import { loadDatasetFeatureCollection, LS_KEYS, parseGeoJsonFromText } from 'gympgrph'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import path from 'node:path'
import { extractEmbeddedGeoJsonGraphDataRequests } from '@/lib/markdown/embeddedGeoJson'
import {
  readTripDemo,
  readTripDemoMmd,
  resolveTripDemoDocumentPath,
  resolveTripDemoMmdDocumentPath,
} from '@/tests/lib/tripDemo'
import type { GraphData } from '@/lib/graph/types'
import { LRUCache } from 'grph-shared/cache/LRUCache'
import { resolveSandboxRoot } from '@/tests/lib/sandboxRoot'
import { buildGeospatialOverlayGraphData } from '@/features/geospatial/geospatialOverlayGraphData'

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

const resolveComputingFlowSamplePath = (): string =>
  path.resolve(process.cwd(), '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-sample.md')

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

export async function testMarkdownGeoJsonLoadGraphAutoEnablesGeospatialMode() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const sampleGeoJson = JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'sg', label: 'Singapore' },
        geometry: { type: 'Point', coordinates: [103.8198, 1.3521] },
      },
      {
        type: 'Feature',
        properties: { id: 'jkt', label: 'Jakarta' },
        geometry: { type: 'Point', coordinates: [106.8456, -6.2088] },
      },
    ],
  })

  let loadedGraph: GraphData | null = null
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setAutoEnableGeospatialOnGeoImport(true)
  storage.setItem(LS_KEYS.geospatialOverlayEnabled, 'false')

  try {
    const integration = createMarkdownGeoDatasetIntegration({
      loadGraphData: graphData => {
        loadedGraph = graphData
      },
    })
    const req = {
      sourceDocumentPath: 'sandbox/test-data/markdown-syntax-computing-flow-sample.md',
      codeBlock: {
        lang: 'geojson' as const,
        text: sampleGeoJson,
        startLine: 1,
        endLine: 16,
      },
    }

    const res = await integration.loadGeoJsonAsGraphData?.(req)
    if (!res || res.ok !== true) {
      throw new Error(`Expected loadGeoJsonAsGraphData to succeed, got ${JSON.stringify(res)}`)
    }
    if (!loadedGraph || loadedGraph.context !== 'geojson') {
      throw new Error('Expected GeoJSON load to provide a geojson graph')
    }
    const enabled = await readGeospatialModeEnabled()
    if (!enabled) {
      throw new Error('Expected GeoJSON graph load from markdown to auto-enable geospatial mode')
    }
  } finally {
    useGraphStore.getState().resetAll()
    restoreWindow()
  }
}

export async function testMarkdownEmbeddedGeoJsonSampleLoadGraphAutoEnablesGeospatialMode() {
  const samplePath = resolveComputingFlowSamplePath()
  if (!fs.existsSync(samplePath)) return

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  let loadedGraph: GraphData | null = null
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setAutoEnableGeospatialOnGeoImport(true)
  storage.setItem(LS_KEYS.geospatialOverlayEnabled, 'false')

  try {
    const markdownText = fs.readFileSync(samplePath, 'utf8')
    const requests = extractEmbeddedGeoJsonGraphDataRequests({
      markdownText,
      sourceDocumentPath: samplePath,
      limit: 4,
    })
    if (requests.length !== 1) {
      throw new Error(`Expected computing-flow sample to yield exactly 1 embedded GeoJSON request, got ${requests.length}`)
    }

    const integration = createMarkdownGeoDatasetIntegration({
      loadGraphData: graphData => {
        loadedGraph = graphData
      },
    })
    const req = requests[0]
    const res = await integration.loadGeoJsonAsGraphData?.(req)
    if (!res || res.ok !== true) {
      throw new Error(`Expected sample embedded GeoJSON load to succeed, got ${JSON.stringify(res)}`)
    }
    if (!loadedGraph || loadedGraph.context !== 'geojson') {
      throw new Error('Expected sample embedded GeoJSON load to provide a geojson graph')
    }
    if (!Array.isArray(loadedGraph.nodes) || loadedGraph.nodes.length < 2) {
      throw new Error('Expected sample embedded GeoJSON load to produce at least two graph nodes')
    }
    const enabled = await readGeospatialModeEnabled()
    if (!enabled) {
      throw new Error('Expected sample embedded GeoJSON graph load to auto-enable geospatial mode')
    }
  } finally {
    useGraphStore.getState().resetAll()
    restoreWindow()
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

export function testTripDemoMmdOverlayGraphDataGetsEmbeddedGeoSupplement() {
  const markdown = readTripDemoMmd()
  if (!markdown) return
  const sourcePath = resolveTripDemoMmdDocumentPath() || 'trip-demo-mmd.md'
  const baseGraph: GraphData = {
    type: 'Graph',
    context: 'markdown',
    nodes: [
      {
        id: 'n:1',
        type: 'MermaidNode',
        label: 'Sydney Opera House',
        properties: {},
      },
    ],
    edges: [],
  }
  const next = buildGeospatialOverlayGraphData({
    graphData: baseGraph,
    markdownText: markdown,
    sourceDocumentPath: sourcePath,
  })
  const nextNodes = Array.isArray(next.nodes) ? next.nodes : []
  if (nextNodes.length <= baseGraph.nodes.length) {
    throw new Error('Expected overlay graph data to be supplemented with embedded GeoJSON nodes from trip-demo-mmd')
  }
  const hasGeo = nextNodes.some(n => {
    const props = (n?.properties || {}) as Record<string, unknown>
    const geo = props.geo as Record<string, unknown> | null
    return !!geo && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng))
  })
  if (!hasGeo) {
    throw new Error('Expected supplemented overlay graph data to contain geo-projected nodes')
  }
}

export function testTripDemoMmdOverlayGraphDataFallsBackToSourceFilesText() {
  const markdown = readTripDemoMmd()
  if (!markdown) return
  const sourcePath = resolveTripDemoMmdDocumentPath() || 'trip-demo-mmd.md'
  const baseGraph: GraphData = {
    type: 'Graph',
    context: 'markdown',
    metadata: { graphId: `workspace:${sourcePath}` },
    nodes: [{ id: 'n:1', type: 'MermaidNode', label: 'Sydney Opera House', properties: {} }],
    edges: [],
  }
  const next = buildGeospatialOverlayGraphData({
    graphData: baseGraph,
    markdownText: '',
    sourceDocumentPath: '',
    sourceFiles: [
      {
        id: 'sf:trip-demo',
        name: 'trip-demo-mmd.md',
        text: markdown,
        enabled: true,
        status: 'parsed',
        source: { kind: 'local', path: sourcePath },
      },
    ],
  })
  const nextNodes = Array.isArray(next.nodes) ? next.nodes : []
  if (nextNodes.length <= baseGraph.nodes.length) {
    throw new Error('Expected overlay graph data to fall back to sourceFiles markdown text for embedded GeoJSON supplement')
  }
}

export function testTripDemoMmdOverlayGraphDataMatchesWorkspacePrefixedSourcePath() {
  const markdown = readTripDemoMmd()
  if (!markdown) return
  const sourcePath = resolveTripDemoMmdDocumentPath() || '/sandbox/demo/trip-demo-mmd.md'
  const docKey = String(sourcePath).replace(/^\/+/, '')
  const baseGraph: GraphData = {
    type: 'Graph',
    context: 'markdown',
    metadata: { graphId: `workspace:${docKey}` },
    nodes: [{ id: 'n:1', type: 'MermaidNode', label: 'Sydney Opera House', properties: {} }],
    edges: [],
  }
  const next = buildGeospatialOverlayGraphData({
    graphData: baseGraph,
    markdownText: '',
    sourceDocumentPath: '',
    sourceFiles: [
      {
        id: 'sf:trip-demo-prefixed',
        name: 'trip-demo-mmd.md',
        text: markdown,
        enabled: true,
        status: 'parsed',
        source: { kind: 'local', path: `workspace:${sourcePath}` },
      },
    ],
  })
  const nextNodes = Array.isArray(next.nodes) ? next.nodes : []
  if (nextNodes.length <= baseGraph.nodes.length) {
    throw new Error('Expected overlay graph data to match workspace-prefixed source file paths outside editor mode')
  }
}

export function testTripDemoMmdOverlayGraphDataUsesParsedSourceGraphOutsideEditorMode() {
  const sourcePath = resolveTripDemoMmdDocumentPath() || '/sandbox/demo/trip-demo-mmd.md'
  const docKey = String(sourcePath).replace(/^\/+/, '')
  const parsedGraph: GraphData = {
    type: 'Graph',
    context: 'geojson',
    nodes: [
      {
        id: 'geo:1',
        type: 'GeoFeature',
        label: 'SIN Singapore Changi',
        properties: { cat: 'airport', geo: { lng: 103.9915, lat: 1.3644 } },
      },
    ],
    edges: [],
  }
  const baseGraph: GraphData = {
    type: 'Graph',
    context: 'markdown',
    metadata: { graphId: `workspace:${docKey}` },
    nodes: [{ id: 'n:1', type: 'MermaidNode', label: 'Sydney Opera House', properties: {} }],
    edges: [],
  }
  const next = buildGeospatialOverlayGraphData({
    graphData: baseGraph,
    markdownText: '',
    sourceDocumentPath: '',
    sourceFiles: [
      {
        id: 'sf:trip-demo-parsed',
        name: 'trip-demo-mmd.md',
        text: '',
        enabled: true,
        status: 'parsed',
        parsedGraphData: parsedGraph,
        source: { kind: 'local', path: `workspace:${sourcePath}` },
      },
    ],
  })
  const nextNodes = Array.isArray(next.nodes) ? next.nodes : []
  if (nextNodes.length <= baseGraph.nodes.length) {
    throw new Error('Expected overlay graph data to use parsed source graph outside editor mode')
  }
  const hasGeo = nextNodes.some(n => {
    const props = (n?.properties || {}) as Record<string, unknown>
    const geo = props.geo as Record<string, unknown> | null
    return !!geo && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng))
  })
  if (!hasGeo) {
    throw new Error('Expected parsed source graph fallback to contribute geo nodes')
  }
}

export async function testGeospatialDatasetLoaderParsesEmbeddedGeoJsonFromMarkdownUrl() {
  const raw = readTripDemo()
  if (!raw) return

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch

  try {
    const sandboxRoot = resolveSandboxRoot()
    if (!sandboxRoot) return
    const abs = path.resolve(path.join(sandboxRoot, 'demo', 'trip-demo.md')).replace(/\\/g, '/')
    const url = abs
    const expectedFetchUrl = `http://localhost:5173/@fs${abs.startsWith('/') ? '' : '/'}${abs}`

    ;(globalThis as unknown as { fetch: unknown }).fetch = (async (input: unknown) => {
      const u = typeof input === 'string' ? input : ''
      if (u !== expectedFetchUrl) {
        return {
          ok: false,
          status: 404,
          headers: { get: () => null },
          body: null,
          text: async () => 'not found',
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: null,
        text: async () => raw,
      } as unknown as Response
    }) as unknown as typeof fetch

    const fc = await loadDatasetFeatureCollection({ url, timeoutMs: 5_000 })

    const features = Array.isArray(fc.features) ? fc.features : []
    if (features.length === 0) throw new Error('Expected markdown dataset URL to produce GeoJSON features')
    const hasSin = features.some(f => String((f as any)?.properties?.code || '') === 'SIN')
    if (!hasSin) throw new Error('Expected extracted features to include SIN airport')
  } finally {
    if (typeof originalFetch === 'undefined') {
      delete (globalThis as unknown as { fetch?: unknown }).fetch
    } else {
      ;(globalThis as unknown as { fetch?: unknown }).fetch = originalFetch
    }
    restoreWindow()
  }
}
