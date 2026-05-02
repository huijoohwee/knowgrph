import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { emitHashChange, HASH_CHANGE_EVENT, subscribeHashChange } from '@/lib/browser/hashChangeEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testHashChangeHelpersCentralizeDispatchAndSubscription = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  let count = 0
  const unsubscribe = subscribeHashChange(() => {
    count += 1
  })

  emitHashChange()
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  if (count !== 1) {
    throw new Error(`expected shared hashchange helper to dispatch one event, got ${count}`)
  }

  let rawCount = 0
  const rawListener = () => {
    rawCount += 1
  }
  dom.window.addEventListener(HASH_CHANGE_EVENT, rawListener as EventListener)
  emitHashChange()
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  if (rawCount !== 1) {
    throw new Error(`expected shared hashchange constant to stay browser-compatible, got ${rawCount}`)
  }

  dom.window.removeEventListener(HASH_CHANGE_EVENT, rawListener as EventListener)
  unsubscribe()
}

export const testHashChangeCallsitesUseSharedContract = () => {
  const helperText = readUtf8('src/lib/browser/hashChangeEvents.ts')
  const mermaidText = readUtf8('src/lib/panels/views/preview-panel/ui/MermaidDiagram.impl.tsx')
  const previewText = readUtf8('src/lib/markdown-core/ui/MarkdownPreviewViewer.impl.tsx')

  if (!helperText.includes('export const HASH_CHANGE_EVENT')) {
    throw new Error('expected hashchange event constant to live in the shared browser helper')
  }
  if (!helperText.includes('export function emitHashChange')) {
    throw new Error('expected shared browser helper to expose hashchange dispatch')
  }
  if (!helperText.includes('export function subscribeHashChange')) {
    throw new Error('expected shared browser helper to expose hashchange subscription')
  }
  if (!helperText.includes('new EventCtor(HASH_CHANGE_EVENT)')) {
    throw new Error('expected shared browser helper to own Event construction for hashchange')
  }
  if (!mermaidText.includes('emitHashChange()')) {
    throw new Error('expected MermaidDiagram to redispatch same-hash navigation through the shared helper')
  }
  if (mermaidText.includes("new Event('hashchange')")) {
    throw new Error('expected MermaidDiagram to avoid inline hashchange Event construction')
  }
  if (!previewText.includes('subscribeHashChange')) {
    throw new Error('expected MarkdownPreviewViewer to subscribe through the shared hashchange helper')
  }
  if (previewText.includes("addEventListener('hashchange'")) {
    throw new Error('expected MarkdownPreviewViewer to avoid raw hashchange listener strings')
  }
}
