import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { emitTocFocus, TOC_FOCUS_EVENT } from '@/features/markdown/ui/tocFocusEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testEmitTocFocusDispatchesSharedEvent = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const events: Array<Record<string, unknown>> = []
  const listener = (event: Event) => {
    const custom = event as CustomEvent<Record<string, unknown>>
    events.push(custom.detail || {})
  }
  dom.window.addEventListener(TOC_FOCUS_EVENT, listener as EventListener)

  emitTocFocus('h-hello')
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = events[events.length - 1]
  if (!last) throw new Error('expected shared TOC focus emitter to dispatch an event')
  if (String(last.id || '') !== 'h-hello') {
    throw new Error(`expected shared TOC focus emitter to preserve id detail, got ${JSON.stringify(last)}`)
  }

  dom.window.removeEventListener(TOC_FOCUS_EVENT, listener as EventListener)
}

export const testTocFocusCallsitesUseSharedEmitterAndConstant = () => {
  const tocHook = readUtf8('src/features/markdown/ui/useMarkdownTocFocusState.ts')
  const selectionSlice = readUtf8('src/hooks/store/selectionSlice.ts')
  const graphTableWorkspace = readUtf8('src/lib/graph-table/ui/GraphTableWorkspace.impl.tsx')
  const helper = readUtf8('src/features/markdown/ui/tocFocusEvents.ts')

  if (!tocHook.includes('TOC_FOCUS_EVENT')) {
    throw new Error('expected TOC focus hook to consume the shared event constant')
  }
  if (tocHook.includes("'kg:tocFocus'")) {
    throw new Error('expected TOC focus hook to avoid inline TOC focus event strings')
  }
  if (!selectionSlice.includes('emitTocFocus(tocId)')) {
    throw new Error('expected selection slice to use the shared TOC focus emitter')
  }
  if (!graphTableWorkspace.includes('emitTocFocus(tocId)')) {
    throw new Error('expected GraphTableWorkspace to use the shared TOC focus emitter')
  }
  if (selectionSlice.includes("'kg:tocFocus'") || graphTableWorkspace.includes("'kg:tocFocus'")) {
    throw new Error('expected TOC focus emitters to avoid inline event strings')
  }
  if (!helper.includes('export const TOC_FOCUS_EVENT')) {
    throw new Error('expected shared TOC focus event constant to exist')
  }
}
