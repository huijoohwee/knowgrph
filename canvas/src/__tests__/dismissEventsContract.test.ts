import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { subscribePointerDownDismiss, subscribeWindowEscapeDismiss } from '@/lib/browser/dismissEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testDismissEventHelpersCentralizeEscapeAndPointerDownDismiss = async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"><button id="inside"></button></div><button id="outside"></button></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  let escapeCount = 0
  const unsubscribeEscape = subscribeWindowEscapeDismiss(() => {
    escapeCount += 1
  })
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (escapeCount !== 1) {
    throw new Error(`expected shared dismiss helper to react to Escape once, got ${escapeCount}`)
  }
  unsubscribeEscape()

  let anyPointerDownCount = 0
  const unsubscribeAnyPointerDown = subscribePointerDownDismiss({
    listener: () => {
      anyPointerDownCount += 1
    },
    target: 'window',
  })
  dom.window.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (anyPointerDownCount !== 1) {
    throw new Error(`expected shared dismiss helper to react to window pointerdown once, got ${anyPointerDownCount}`)
  }
  unsubscribeAnyPointerDown()

  const root = dom.window.document.getElementById('root')
  const inside = dom.window.document.getElementById('inside')
  const outside = dom.window.document.getElementById('outside')
  if (!(root instanceof dom.window.HTMLElement) || !(inside instanceof dom.window.HTMLElement) || !(outside instanceof dom.window.HTMLElement)) {
    throw new Error('expected dismiss helper runtime test DOM to exist')
  }

  let outsideCount = 0
  const unsubscribeOutsidePointerDown = subscribePointerDownDismiss({
    listener: () => {
      outsideCount += 1
    },
    root,
    target: 'document',
    capture: true,
  })
  inside.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
  outside.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (outsideCount !== 1) {
    throw new Error(`expected shared dismiss helper to ignore inside clicks and dismiss on outside clicks once, got ${outsideCount}`)
  }
  unsubscribeOutsidePointerDown()
}

export const testDismissEventCallsitesUseSharedHelperBoundary = () => {
  const helperText = readUtf8('src/lib/browser/dismissEvents.ts')
  const fileTreeText = readUtf8('src/features/markdown-workspace/MarkdownFileTree.tsx')
  const selectionMenuText = readUtf8('src/features/markdown-workspace/SelectionActionsMenu.tsx')

  if (!helperText.includes('export function subscribeWindowEscapeDismiss')) {
    throw new Error('expected shared dismiss helper module to expose Escape dismissal subscription')
  }
  if (!helperText.includes('export function subscribePointerDownDismiss')) {
    throw new Error('expected shared dismiss helper module to expose pointerdown dismissal subscription')
  }
  if (!fileTreeText.includes('subscribePointerDownDismiss({') || !fileTreeText.includes('subscribeWindowEscapeDismiss(closeContextMenu)')) {
    throw new Error('expected MarkdownFileTree to use shared dismiss helpers for context-menu close wiring')
  }
  if (fileTreeText.includes("window.addEventListener('pointerdown'")) {
    throw new Error('expected MarkdownFileTree to avoid raw pointerdown dismissal listener wiring')
  }
  if (fileTreeText.includes("window.addEventListener('keydown'")) {
    throw new Error('expected MarkdownFileTree to avoid raw Escape dismissal listener wiring')
  }
  if (!selectionMenuText.includes('subscribePointerDownDismiss({') || !selectionMenuText.includes('subscribeWindowEscapeDismiss')) {
    throw new Error('expected SelectionActionsMenu to use shared dismiss helpers')
  }
  if (selectionMenuText.includes("document.addEventListener('pointerdown'")) {
    throw new Error('expected SelectionActionsMenu to avoid raw outside-pointerdown dismissal wiring')
  }
  if (selectionMenuText.includes("window.addEventListener('keydown'")) {
    throw new Error('expected SelectionActionsMenu to avoid raw Escape dismissal wiring')
  }
}
