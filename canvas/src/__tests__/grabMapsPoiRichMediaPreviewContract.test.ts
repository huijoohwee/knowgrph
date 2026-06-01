import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  GRABMAPS_POI_RICH_MEDIA_PREVIEW_EVENT,
  buildGrabMapsPoiRichMediaSrcDoc,
  publishGrabMapsPoiRichMediaPreview,
  readGrabMapsPoiRichMediaPreviewEventDetail,
  subscribeGrabMapsPoiRichMediaPreview,
} from '@/features/geospatial/grabMapsPoiRichMedia'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testGrabMapsPoiPreviewHelpersCentralizeEventDispatchAndParsing = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const received: Array<Record<string, unknown>> = []
  const unsubscribe = subscribeGrabMapsPoiRichMediaPreview(payload => {
    received.push(payload as unknown as Record<string, unknown>)
  })

  publishGrabMapsPoiRichMediaPreview({
    targetNodeId: 'node-1',
    srcDoc: ' <main>poi</main> ',
    label: '  POI label  ',
  })
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = received[received.length - 1]
  if (!last) throw new Error('expected GrabMaps POI preview helper to dispatch a preview payload')
  if (String(last.targetNodeId || '') !== 'node-1') {
    throw new Error(`expected shared GrabMaps preview listener to preserve targetNodeId, got ${JSON.stringify(last)}`)
  }
  if (String(last.srcDoc || '') !== '<main>poi</main>') {
    throw new Error(`expected shared GrabMaps preview listener to normalize srcDoc, got ${JSON.stringify(last)}`)
  }
  if (String(last.label || '') !== 'POI label') {
    throw new Error(`expected shared GrabMaps preview listener to normalize label, got ${JSON.stringify(last)}`)
  }

  const rawEvent = new dom.window.CustomEvent(GRABMAPS_POI_RICH_MEDIA_PREVIEW_EVENT, {
    detail: { targetNodeId: 'node-2', srcDoc: ' test ', label: ' hello ' },
  })
  const parsed = readGrabMapsPoiRichMediaPreviewEventDetail(rawEvent)
  if (!parsed) throw new Error('expected shared GrabMaps preview parser to read CustomEvent detail')
  if (parsed.targetNodeId !== 'node-2' || parsed.srcDoc !== 'test' || parsed.label !== 'hello') {
    throw new Error(`expected shared GrabMaps preview parser to normalize CustomEvent detail, got ${JSON.stringify(parsed)}`)
  }

  unsubscribe()
}

export const testGrabMapsPoiPreviewCallsitesUseSharedHelpers = () => {
  const helperText = readUtf8('src/features/geospatial/grabMapsPoiRichMedia.ts')
  const viewportText = readUtf8('src/components/CanvasViewportGeospatialOverlay.tsx')
  const richMediaPanelText = readUtf8('src/components/RichMediaPanel.tsx')

  if (!helperText.includes('export function subscribeGrabMapsPoiRichMediaPreview')) {
    throw new Error('expected geospatial preview helper module to expose a shared preview subscription helper')
  }
  if (!helperText.includes('export function readGrabMapsPoiRichMediaPreviewEventDetail')) {
    throw new Error('expected geospatial preview helper module to expose shared event detail parsing')
  }
  if (!helperText.includes('new CustomEventCtor(GRABMAPS_POI_RICH_MEDIA_PREVIEW_EVENT')) {
    throw new Error('expected GrabMaps POI preview emitter to use the shared event constant')
  }
  if (!viewportText.includes('publishGrabMapsPoiRichMediaPreview({')) {
    throw new Error('expected CanvasViewportGeospatialOverlay to keep publishing GrabMaps POI previews through the shared helper')
  }
  if (!richMediaPanelText.includes('subscribeGrabMapsPoiRichMediaPreview')) {
    throw new Error('expected RichMediaPanel to subscribe through the shared GrabMaps preview helper')
  }
  if (richMediaPanelText.includes('addEventListener(GRABMAPS_POI_RICH_MEDIA_PREVIEW_EVENT')) {
    throw new Error('expected RichMediaPanel to avoid raw GrabMaps preview event listener wiring')
  }
}

export const testGrabMapsPoiSrcDocIncludesRichGeoMetadataAndNeutralActions = () => {
  const srcDoc = buildGrabMapsPoiRichMediaSrcDoc({
    label: 'Marina Bay Sands',
    lat: 1.2834,
    lng: 103.8607,
    address: '10 Bayfront Ave, Singapore',
    category: 'landmark',
    properties: {
      Rank: 1,
      'C*': 0.82,
      'Decisive signal': 'zero competition near transit',
      'Residential POI Count': 22,
      kgSourceDocumentPath: '/reports/site-selection.md',
    },
  })
  if (!srcDoc.includes('Coordinates</strong><span>1.283400, 103.860700</span>')) {
    throw new Error('expected GrabMaps POI srcdoc to include normalized six-decimal coordinates')
  }
  if (!srcDoc.includes('Open coordinates in OpenStreetMap')) {
    throw new Error('expected GrabMaps POI srcdoc to include a neutral coordinate map action')
  }
  if (!srcDoc.includes('Open location via geo URI')) {
    throw new Error('expected GrabMaps POI srcdoc to include a provider-agnostic geo URI action')
  }
  if (!srcDoc.includes('&quot;coordinates&quot;: {')) {
    throw new Error('expected GrabMaps POI srcdoc to include a structured payload preview')
  }
  if (!srcDoc.includes('<strong>C*</strong><span>0.82</span>')) {
    throw new Error('expected GrabMaps POI srcdoc to preserve generic score metadata from source properties')
  }
  if (!srcDoc.includes('<strong>Decisive Signal</strong><span>zero competition near transit</span>')) {
    throw new Error('expected GrabMaps POI srcdoc to render qualitative geo metadata from source properties')
  }
  if (!srcDoc.includes('<strong>Residential POI Count</strong><span>22</span>')) {
    throw new Error('expected GrabMaps POI srcdoc to render source count metrics without report-specific hardcoding')
  }
  if (!srcDoc.includes('<strong>Source document</strong><span>/reports/site-selection.md</span>')) {
    throw new Error('expected GrabMaps POI srcdoc to include source provenance when available')
  }
  if (!srcDoc.includes('aria-label="POI mini-map snapshot"') || !srcDoc.includes('<svg viewBox="0 0 320 170"')) {
    throw new Error('expected GrabMaps POI srcdoc to include an inline mini-map SVG snapshot block')
  }
  if (!srcDoc.includes('<circle cx="') || !srcDoc.includes('fill="#ef4444"')) {
    throw new Error('expected GrabMaps POI srcdoc mini-map to render a visible POI marker')
  }
}
