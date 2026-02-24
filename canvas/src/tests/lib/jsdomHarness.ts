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
  const originalObjectProtoHtmlIFrameElementDesc = Object.getOwnPropertyDescriptor(Object.prototype, 'HTMLIFrameElement')
  const originalDocumentProtoActiveElementDesc = Object.getOwnPropertyDescriptor(dom.window.Document.prototype, 'activeElement')
  const originalDocumentActiveElementDesc = Object.getOwnPropertyDescriptor(dom.window.document, 'activeElement')
  const originalResizeObserver = (g as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
  const originalRequestAnimationFrame = (g as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame
  const originalCancelAnimationFrame = (g as unknown as { cancelAnimationFrame?: unknown }).cancelAnimationFrame
  const originalMermaidStub = (g as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__
  let iframeWindowPatchObserver: MutationObserver | null = null

  ;(g as { window: Window }).window = dom.window as unknown as Window
  ;(g as { document: Document }).document = dom.window.document as unknown as Document
  ;(g as { Node: typeof Node }).Node = dom.window.Node as unknown as typeof Node
  ;(g as { Element: typeof Element }).Element = dom.window.Element as unknown as typeof Element
  ;(g as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement

  try {
    const proto = (dom.window as unknown as { HTMLCanvasElement?: { prototype?: { getContext?: unknown } } }).HTMLCanvasElement?.prototype
    if (proto) {
      ;(proto as unknown as { getContext?: unknown }).getContext = (() => {
        const noop = () => void 0
        return {
          canvas: null,
          clearRect: noop,
          fillRect: noop,
          strokeRect: noop,
          beginPath: noop,
          closePath: noop,
          moveTo: noop,
          lineTo: noop,
          rect: noop,
          arc: noop,
          clip: noop,
          stroke: noop,
          fill: noop,
          fillText: noop,
          measureText: (text: string) => ({ width: String(text || '').length * 6 }),
          save: noop,
          restore: noop,
          translate: noop,
          scale: noop,
          setTransform: noop,
          resetTransform: noop,
          createLinearGradient: () => ({ addColorStop: noop }),
          createRadialGradient: () => ({ addColorStop: noop }),
          createPattern: () => null,
          drawImage: noop,
          getImageData: () => ({ data: new Uint8ClampedArray(0) }),
          putImageData: noop,
          globalAlpha: 1,
          fillStyle: '#000',
          strokeStyle: '#000',
          lineWidth: 1,
          font: '12px sans-serif',
          textBaseline: 'alphabetic',
          textAlign: 'start',
        } as unknown
      }) as unknown
    }
  } catch {
    void 0
  }
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

    const anyJsdomWindow = dom.window as unknown as { Window?: { prototype?: Record<string, unknown> }; HTMLIFrameElement?: unknown }
    if (anyJsdomWindow.Window?.prototype && anyJsdomWindow.HTMLIFrameElement) {
      anyJsdomWindow.Window.prototype.HTMLIFrameElement = anyJsdomWindow.HTMLIFrameElement
    }

    const iframeProto = (dom.window as unknown as { HTMLIFrameElement?: { prototype?: unknown } }).HTMLIFrameElement?.prototype as
      | { contentWindow?: unknown }
      | undefined
    if (iframeProto && anyWindow.HTMLIFrameElement) {
      const desc = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow')
      if (desc?.get) {
        Object.defineProperty(iframeProto, 'contentWindow', {
          configurable: true,
          enumerable: desc.enumerable ?? false,
          get() {
            const w = desc.get!.call(this) as unknown as Record<string, unknown> | null
            if (w && typeof w === 'object' && !('HTMLIFrameElement' in w)) {
              try {
                ;(w as { HTMLIFrameElement?: unknown }).HTMLIFrameElement = anyWindow.HTMLIFrameElement
              } catch {
                void 0
              }
            }
            return w as unknown
          },
        })
      }
    }

    if (anyWindow.HTMLIFrameElement && !Object.prototype.hasOwnProperty.call(Object.prototype, 'HTMLIFrameElement')) {
      Object.defineProperty(Object.prototype, 'HTMLIFrameElement', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: anyWindow.HTMLIFrameElement,
      })
    }

    try {
      Object.defineProperty(dom.window.document, 'activeElement', {
        configurable: true,
        enumerable: originalDocumentActiveElementDesc?.enumerable ?? false,
        get() {
          return dom.window.document.body || dom.window.document.documentElement
        },
      })
    } catch {
      if (originalDocumentProtoActiveElementDesc?.get) {
        Object.defineProperty(dom.window.Document.prototype, 'activeElement', {
          configurable: true,
          enumerable: originalDocumentProtoActiveElementDesc.enumerable ?? false,
          get() {
            const d = this as unknown as Document
            return d.body || d.documentElement
          },
        })
      }
    }

    const patchIframeWindows = () => {
      const IFrameCtor = (dom.window as unknown as { HTMLIFrameElement?: unknown }).HTMLIFrameElement
      if (!IFrameCtor) return
      const iframes = Array.from(dom.window.document.querySelectorAll('iframe'))
      for (const el of iframes) {
        try {
          const iframe = el as unknown as { contentWindow?: unknown }
          const w = iframe.contentWindow as unknown as Record<string, unknown> | null
          if (!w || typeof w !== 'object') continue
          if (!('HTMLIFrameElement' in w)) {
            ;(w as { HTMLIFrameElement?: unknown }).HTMLIFrameElement = IFrameCtor
          }
        } catch {
          void 0
        }
      }
    }

    patchIframeWindows()
    if (typeof dom.window.MutationObserver !== 'undefined') {
      iframeWindowPatchObserver = new dom.window.MutationObserver(() => patchIframeWindows())
      iframeWindowPatchObserver.observe(dom.window.document.body, { childList: true, subtree: true })
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

    try {
      iframeWindowPatchObserver?.disconnect()
    } catch {
      void 0
    }
    iframeWindowPatchObserver = null

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

    if (typeof originalDocumentActiveElementDesc === 'undefined') {
      delete (dom.window.document as unknown as { activeElement?: unknown }).activeElement
    } else {
      Object.defineProperty(dom.window.document, 'activeElement', originalDocumentActiveElementDesc)
    }

    if (typeof originalObjectProtoHtmlIFrameElementDesc === 'undefined') {
      delete (Object.prototype as unknown as { HTMLIFrameElement?: unknown }).HTMLIFrameElement
    } else {
      Object.defineProperty(Object.prototype, 'HTMLIFrameElement', originalObjectProtoHtmlIFrameElementDesc)
    }

    dom.window.close()
  }

  return { dom, restore }
}
