import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { emitHelpScrollToAnchor, HELP_SCROLL_TO_ANCHOR_EVENT } from '@/features/panels/utils/helpPanelEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testEmitHelpScrollToAnchorDispatchesSharedEvent = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const events: Array<Record<string, unknown>> = []
  const listener = (event: Event) => {
    const custom = event as CustomEvent<Record<string, unknown>>
    events.push(custom.detail || {})
  }
  dom.window.addEventListener(HELP_SCROLL_TO_ANCHOR_EVENT, listener as EventListener)

  emitHelpScrollToAnchor('help.graphLayers')
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = events[events.length - 1]
  if (!last) throw new Error('expected help scroll emitter to dispatch an event')
  if (String(last.anchor || '') !== 'help.graphLayers') {
    throw new Error(`expected help scroll emitter to preserve anchor detail, got ${JSON.stringify(last)}`)
  }

  dom.window.removeEventListener(HELP_SCROLL_TO_ANCHOR_EVENT, listener as EventListener)
}

export const testHelpPanelCallsitesUseSharedScrollEmitter = () => {
  const schemaSummary = readUtf8('src/features/panels/ui/SchemaSummary.tsx')
  const helpLogic = readUtf8('src/features/panels/hooks/useHelpViewLogic.ts')
  const eventHelper = readUtf8('src/features/panels/utils/helpPanelEvents.ts')

  if (!schemaSummary.includes('emitHelpScrollToAnchor(UI_ANCHORS.helpGraphLayers)')) {
    throw new Error('expected SchemaSummary to use the shared help scroll emitter')
  }
  if (schemaSummary.includes("new CustomEvent('kg:helpScrollToAnchor'")) {
    throw new Error('expected SchemaSummary to avoid direct help scroll custom-event boilerplate')
  }
  if (!helpLogic.includes('HELP_SCROLL_TO_ANCHOR_EVENT')) {
    throw new Error('expected useHelpViewLogic to consume the shared help scroll event constant')
  }
  if (helpLogic.includes("'kg:helpScrollToAnchor'")) {
    throw new Error('expected useHelpViewLogic to avoid inline help scroll event strings')
  }
  if (!eventHelper.includes('export function emitHelpScrollToAnchor')) {
    throw new Error('expected shared help scroll emitter helper to exist')
  }
}
