import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { BOTTOM_PANEL_OPEN_EVENT, openBottomPanel } from '@/features/bottom-panel/open'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testOpenBottomPanelDispatchesSharedEvent = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const events: Array<Record<string, unknown>> = []
  const listener = (event: Event) => {
    const custom = event as CustomEvent<Record<string, unknown>>
    events.push(custom.detail || {})
  }
  dom.window.addEventListener(BOTTOM_PANEL_OPEN_EVENT, listener as EventListener)

  openBottomPanel('render')
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = events[events.length - 1]
  if (!last) throw new Error('expected openBottomPanel to dispatch the shared bottom-panel event')
  if (String(last.tab || '') !== 'render') {
    throw new Error(`expected openBottomPanel to preserve tab detail, got ${JSON.stringify(last)}`)
  }

  dom.window.removeEventListener(BOTTOM_PANEL_OPEN_EVENT, listener as EventListener)
}

export const testBottomPanelOpenCallsitesUseSharedContract = () => {
  const openText = readUtf8('src/features/bottom-panel/open.ts')
  const headerText = readUtf8('src/components/BottomPanel/BottomPanelHeader.tsx')

  if (!openText.includes('export const BOTTOM_PANEL_OPEN_EVENT')) {
    throw new Error('expected bottom-panel open event constant to live in the shared helper module')
  }
  if (!openText.includes('new CustomEventCtor(BOTTOM_PANEL_OPEN_EVENT')) {
    throw new Error('expected openBottomPanel to dispatch using the shared event constant')
  }
  if (openText.includes("new CustomEvent('kg:open-bottom-panel'")) {
    throw new Error('expected openBottomPanel to avoid inline bottom-panel event strings')
  }
  if (!headerText.includes("openBottomPanel('render')")) {
    throw new Error('expected BottomPanelHeader to keep using the shared openBottomPanel helper')
  }
}
