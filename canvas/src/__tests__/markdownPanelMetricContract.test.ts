import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  emitMarkdownPanelMetric,
  MARKDOWN_PANEL_METRIC_EVENT,
  readUiMetricEventDetail,
  subscribeMarkdownPanelMetric,
} from '@/features/metrics/uiMetrics'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testMarkdownPanelMetricHelpersCentralizeEventDispatchAndSubscription = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const events: Array<Record<string, unknown>> = []
  const unsubscribe = subscribeMarkdownPanelMetric(detail => {
    events.push(detail)
  })

  emitMarkdownPanelMetric('overlay.sample', { overlayCount: 3 })
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = events[events.length - 1]
  if (!last) throw new Error('expected shared markdown metric helper to dispatch an event')
  if (String(last.event || '') !== 'overlay.sample') {
    throw new Error(`expected markdown metric event name to round-trip, got ${JSON.stringify(last)}`)
  }
  if (Number(last.overlayCount || 0) !== 3) {
    throw new Error(`expected markdown metric payload to round-trip, got ${JSON.stringify(last)}`)
  }

  const rawEvent = new dom.window.CustomEvent(MARKDOWN_PANEL_METRIC_EVENT, {
    detail: { event: 'trim.test', panel: ' viewer ' },
  })
  const parsed = readUiMetricEventDetail(rawEvent)
  if (!parsed) throw new Error('expected shared ui metric parser to read CustomEvent detail')
  if (parsed.event !== 'trim.test' || String(parsed.panel || '') !== ' viewer ') {
    throw new Error(`expected shared ui metric parser to preserve detail fields, got ${JSON.stringify(parsed)}`)
  }

  unsubscribe()
}

export const testMarkdownPanelMetricCallsitesUseSharedContract = () => {
  const metricsText = readUtf8('src/features/metrics/uiMetrics.ts')
  const canvasViewportText = readUtf8('src/components/CanvasViewport.tsx')
  const viewerHeaderText = readUtf8('src/components/BottomPanel/BottomPanelMarkdownViewerHeader.tsx')
  const markdownApplyText = readUtf8('src/components/BottomPanel/hooks/useMarkdownApply.ts')
  const overlaysText = readUtf8('src/components/GraphCanvasRoot/hooks/useRichMediaOverlays2d.ts')

  if (!metricsText.includes('export const MARKDOWN_PANEL_METRIC_EVENT')) {
    throw new Error('expected markdown panel metric event constant to live in the shared metrics helper')
  }
  if (!metricsText.includes('export function subscribeMarkdownPanelMetric')) {
    throw new Error('expected shared metrics helper to expose markdown metric subscription')
  }
  if (!metricsText.includes('export function readUiMetricEventDetail')) {
    throw new Error('expected shared metrics helper to expose ui metric detail parsing')
  }
  if (!canvasViewportText.includes('subscribeMarkdownPanelMetric')) {
    throw new Error('expected CanvasViewport to subscribe via the shared markdown metric helper')
  }
  if (canvasViewportText.includes("addEventListener('kg:markdownPanelMetric'")) {
    throw new Error('expected CanvasViewport to avoid raw markdown metric event listener strings')
  }
  if (!viewerHeaderText.includes('emitMarkdownPanelMetric(')) {
    throw new Error('expected markdown viewer header to emit through the shared metric helper')
  }
  if (!markdownApplyText.includes('emitMarkdownPanelMetric(')) {
    throw new Error('expected markdown apply flow to emit through the shared metric helper')
  }
  if (!overlaysText.includes('emitMarkdownPanelMetric(')) {
    throw new Error('expected rich-media overlays to emit through the shared metric helper')
  }
}
