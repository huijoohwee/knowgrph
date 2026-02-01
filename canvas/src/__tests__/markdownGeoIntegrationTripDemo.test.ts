import { LS_KEYS, parseGeoJsonFromText } from 'gympgrph'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readTripDemo, resolveTripDemoDocumentPath } from '@/tests/lib/tripDemo'

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
