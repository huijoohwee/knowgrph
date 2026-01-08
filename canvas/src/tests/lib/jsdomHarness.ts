import { JSDOM } from 'jsdom'

export type JsdomHarnessEnv = {
  dom: JSDOM
  restore: () => void
}

export const initJsdomHarness = (html: string = '<!doctype html><html><body></body></html>'): JsdomHarnessEnv => {
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    contentType: 'text/html',
    pretendToBeVisual: true,
  })

  const g = globalThis as typeof globalThis

  const originalWindow = (g as { window?: unknown }).window as Window | undefined
  const originalDocument = (g as { document?: unknown }).document as Document | undefined
  const originalNode = (g as { Node?: typeof Node }).Node
  const originalElement = (g as { Element?: typeof Element }).Element
  const originalDomParser = (g as { DOMParser?: typeof DOMParser }).DOMParser

  ;(g as { window: Window }).window = dom.window as unknown as Window
  ;(g as { document: Document }).document = dom.window.document as unknown as Document
  ;(g as { Node: typeof Node }).Node = dom.window.Node as unknown as typeof Node
  ;(g as { Element: typeof Element }).Element = dom.window.Element as unknown as typeof Element
  ;(g as { DOMParser: typeof DOMParser }).DOMParser = dom.window.DOMParser as unknown as typeof DOMParser

  const restore = () => {
    if (typeof originalWindow === 'undefined') {
      delete (g as { window?: Window }).window
    } else {
      ;(g as { window: Window }).window = originalWindow
    }

    if (typeof originalDocument === 'undefined') {
      delete (g as { document?: Document }).document
    } else {
      ;(g as { document: Document }).document = originalDocument
    }

    if (typeof originalNode === 'undefined') {
      delete (g as { Node?: typeof Node }).Node
    } else {
      ;(g as { Node: typeof Node }).Node = originalNode as typeof Node
    }

    if (typeof originalElement === 'undefined') {
      delete (g as { Element?: typeof Element }).Element
    } else {
      ;(g as { Element: typeof Element }).Element = originalElement as typeof Element
    }

    if (typeof originalDomParser === 'undefined') {
      delete (g as { DOMParser?: typeof DOMParser }).DOMParser
    } else {
      ;(g as { DOMParser: typeof DOMParser }).DOMParser = originalDomParser as typeof DOMParser
    }

    dom.window.close()
  }

  return { dom, restore }
}
