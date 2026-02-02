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
  const originalHTMLElement = (g as { HTMLElement?: typeof HTMLElement }).HTMLElement
  const originalNodeFilter = (g as { NodeFilter?: typeof NodeFilter }).NodeFilter
  const originalDomParser = (g as { DOMParser?: typeof DOMParser }).DOMParser
  const originalHtmlIFrameElement = (g as { HTMLIFrameElement?: typeof HTMLIFrameElement }).HTMLIFrameElement
  const originalResizeObserver = (g as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
  const originalRequestAnimationFrame = (g as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame
  const originalCancelAnimationFrame = (g as unknown as { cancelAnimationFrame?: unknown }).cancelAnimationFrame
  const originalMermaidStub = (g as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__

  ;(g as { window: Window }).window = dom.window as unknown as Window
  ;(g as { document: Document }).document = dom.window.document as unknown as Document
  ;(g as { Node: typeof Node }).Node = dom.window.Node as unknown as typeof Node
  ;(g as { Element: typeof Element }).Element = dom.window.Element as unknown as typeof Element
  ;(g as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement
  const nodeFilter = (dom.window as unknown as { NodeFilter?: typeof NodeFilter }).NodeFilter
  const polyfillNodeFilter = (nodeFilter ||
    ({
      FILTER_ACCEPT: 1,
      FILTER_REJECT: 2,
      FILTER_SKIP: 3,
      SHOW_ALL: -1,
      SHOW_ELEMENT: 1,
      SHOW_ATTRIBUTE: 2,
      SHOW_TEXT: 4,
      SHOW_CDATA_SECTION: 8,
      SHOW_ENTITY_REFERENCE: 16,
      SHOW_ENTITY: 32,
      SHOW_PROCESSING_INSTRUCTION: 64,
      SHOW_COMMENT: 128,
      SHOW_DOCUMENT: 256,
      SHOW_DOCUMENT_TYPE: 512,
      SHOW_DOCUMENT_FRAGMENT: 1024,
      SHOW_NOTATION: 2048,
    } as unknown as typeof NodeFilter))

  ;(g as { NodeFilter: typeof NodeFilter }).NodeFilter = polyfillNodeFilter
  ;(dom.window as unknown as { NodeFilter: typeof NodeFilter }).NodeFilter = polyfillNodeFilter
  ;(g as { DOMParser: typeof DOMParser }).DOMParser = dom.window.DOMParser as unknown as typeof DOMParser

  try {
    const anyWindow = dom.window as unknown as { HTMLIFrameElement?: typeof HTMLIFrameElement }
    const anyGlobal = g as unknown as { HTMLIFrameElement?: typeof HTMLIFrameElement }
    if (anyWindow.HTMLIFrameElement) {
      anyGlobal.HTMLIFrameElement = anyWindow.HTMLIFrameElement
    } else if (typeof HTMLIFrameElement !== 'undefined') {
      anyGlobal.HTMLIFrameElement = HTMLIFrameElement
    } else {
      anyGlobal.HTMLIFrameElement = class {} as typeof HTMLIFrameElement
    }

    // Polyfill ResizeObserver
    const anyGlobalResize = g as unknown as { ResizeObserver: unknown }
    if (!anyGlobalResize.ResizeObserver) {
      anyGlobalResize.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
  } catch {
    void 0
  }

  const anyWindow = dom.window as unknown as {
    requestAnimationFrame?: (cb: FrameRequestCallback) => number
    cancelAnimationFrame?: (id: number) => void
    setTimeout: typeof setTimeout
    clearTimeout: typeof clearTimeout
  }

  anyWindow.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number
  anyWindow.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as never)

  ;(g as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
    anyWindow.requestAnimationFrame.bind(dom.window)
  ;(g as unknown as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame =
    anyWindow.cancelAnimationFrame.bind(dom.window)

  ;(g as unknown as { __KG_TEST_MERMAID_API__: unknown }).__KG_TEST_MERMAID_API__ = {
    initialize: () => void 0,
    render: async () => ({ svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>' }),
  }

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

    if (typeof originalHTMLElement === 'undefined') {
      delete (g as { HTMLElement?: typeof HTMLElement }).HTMLElement
    } else {
      ;(g as { HTMLElement: typeof HTMLElement }).HTMLElement = originalHTMLElement as typeof HTMLElement
    }

    if (typeof originalNodeFilter === 'undefined') {
      delete (g as { NodeFilter?: typeof NodeFilter }).NodeFilter
    } else {
      ;(g as { NodeFilter: typeof NodeFilter }).NodeFilter = originalNodeFilter as typeof NodeFilter
    }

    if (typeof originalDomParser === 'undefined') {
      delete (g as { DOMParser?: typeof DOMParser }).DOMParser
    } else {
      ;(g as { DOMParser: typeof DOMParser }).DOMParser = originalDomParser as typeof DOMParser
    }

    if (typeof originalHtmlIFrameElement === 'undefined') {
      delete (g as { HTMLIFrameElement?: typeof HTMLIFrameElement }).HTMLIFrameElement
    } else {
      ;(g as { HTMLIFrameElement: typeof HTMLIFrameElement }).HTMLIFrameElement =
        originalHtmlIFrameElement as typeof HTMLIFrameElement
    }

    if (typeof originalMermaidStub === 'undefined') {
      delete (g as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__
    } else {
      ;(g as unknown as { __KG_TEST_MERMAID_API__: unknown }).__KG_TEST_MERMAID_API__ = originalMermaidStub
    }

    if (typeof originalResizeObserver === 'undefined') {
      delete (g as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
    } else {
      ;(g as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = originalResizeObserver
    }

    if (typeof originalRequestAnimationFrame === 'undefined') {
      delete (g as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame
    } else {
      ;(g as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = originalRequestAnimationFrame
    }

    if (typeof originalCancelAnimationFrame === 'undefined') {
      delete (g as unknown as { cancelAnimationFrame?: unknown }).cancelAnimationFrame
    } else {
      ;(g as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = originalCancelAnimationFrame
    }

    dom.window.close()
  }

  return { dom, restore }
}
