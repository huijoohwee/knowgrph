import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { emitTextSelectionEvent, TEXT_SELECTION_EVENT } from '@/features/hooks/textSelectionEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testTextSelectionEventHelperCentralizesSyntheticSelectDispatch = async () => {
  const dom = new JSDOM('<!doctype html><html><body><textarea></textarea></body></html>', { url: 'http://localhost' })
  const textarea = dom.window.document.querySelector('textarea')
  if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
    throw new Error('expected test textarea to exist')
  }

  let count = 0
  let lastBubbles = false
  textarea.addEventListener(TEXT_SELECTION_EVENT, event => {
    count += 1
    lastBubbles = event.bubbles
  })

  emitTextSelectionEvent(textarea)
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  if (count !== 1) {
    throw new Error(`expected shared text selection helper to dispatch one select event, got ${count}`)
  }
  if (!lastBubbles) {
    throw new Error('expected shared text selection helper to preserve bubbling select events')
  }
}

export const testTextSelectionEventCallsitesUseSharedHelper = () => {
  const helperText = readUtf8('src/features/hooks/textSelectionEvents.ts')
  const hookText = readUtf8('src/features/hooks/useEditorTextareaHandlers.ts')

  if (!helperText.includes('export const TEXT_SELECTION_EVENT')) {
    throw new Error('expected text selection event constant to live in the shared helper module')
  }
  if (!helperText.includes('export function emitTextSelectionEvent')) {
    throw new Error('expected text selection helper module to expose a shared select-event emitter')
  }
  if (!helperText.includes('new EventCtor(TEXT_SELECTION_EVENT, { bubbles: true })')) {
    throw new Error('expected text selection helper to own synthetic select event construction')
  }
  if (!hookText.includes('emitTextSelectionEvent(el)')) {
    throw new Error('expected editor textarea handlers to delegate select dispatch to the shared helper')
  }
  if (hookText.includes("new Event('select', { bubbles: true })")) {
    throw new Error('expected editor textarea handlers to avoid inline select event construction')
  }
}
