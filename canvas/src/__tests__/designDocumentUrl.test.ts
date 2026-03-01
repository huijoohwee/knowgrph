import { tryExtractDesignDocumentUrl } from '@/lib/render/designDocumentUrl'
import type { GraphData } from '@/lib/graph/types'

export function testDesignDocumentUrlIgnoresMediaAssetUrls() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'img:1',
        label: 'Image 1',
        type: 'Image',
        properties: { media_kind: 'image', media_url: 'https://example.invalid/a.png' },
        metadata: { url: 'https://example.invalid/a.png' },
      },
    ],
    edges: [],
    metadata: {},
  }
  const out = tryExtractDesignDocumentUrl(g)
  if (out != null) throw new Error(`expected null documentUrl for media asset, got: ${String(out)}`)
}

export function testDesignDocumentUrlUsesExplicitDocumentUrl() {
  const g: GraphData = { type: 'Graph', nodes: [], edges: [], metadata: { documentUrl: 'https://example.invalid/page' } }
  const out = tryExtractDesignDocumentUrl(g)
  if (out !== 'https://example.invalid/page') throw new Error(`expected documentUrl from metadata, got: ${String(out)}`)
}

export function testDesignDocumentUrlFallsBackToNodeMetadataDocumentUrl() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'doc:1',
        label: 'Doc',
        type: 'Document',
        properties: {},
        metadata: { documentUrl: 'https://example.invalid/page' },
      },
    ],
    edges: [],
    metadata: {},
  }
  const out = tryExtractDesignDocumentUrl(g)
  if (out !== 'https://example.invalid/page') throw new Error(`expected documentUrl from node metadata, got: ${String(out)}`)
}

export function testDesignDocumentUrlFallsBackToEdgeMetadataDocumentPath() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [],
    edges: [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        label: 'link',
        type: 'Link',
        properties: {},
        metadata: { documentPath: 'https://example.invalid/page' },
      },
    ],
    metadata: {},
  }
  const out = tryExtractDesignDocumentUrl(g)
  if (out !== 'https://example.invalid/page') throw new Error(`expected documentUrl from edge metadata, got: ${String(out)}`)
}
