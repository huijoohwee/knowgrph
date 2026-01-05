type TestEventListener = (event: Event) => void

type DomHarnessWindow = Window &
  typeof globalThis & {
    getComputedStyle?: (el: Element) => CSSStyleDeclaration
    requestAnimationFrame?: (cb: FrameRequestCallback) => number
  }

export type DomHarnessEnv = {
  g: DomHarnessWindow
  restore: () => void
}

export const DOM_HARNESS_LINES = [
  'line1',
  'line2',
  'line3',
  'line4',
  'line5',
  'line6',
  'line7',
  'line8',
  'line9',
  'line10',
  'line11',
  'line12',
]

export const DOM_HARNESS_TEXT = DOM_HARNESS_LINES.join('\n')

export function initDomHarnessWindow(): DomHarnessEnv {
  const g = globalThis as unknown as DomHarnessWindow
  const originalGetComputedStyle = g.getComputedStyle
  const originalRequestAnimationFrame = g.requestAnimationFrame
  const originalAddEventListener = g.addEventListener
  const originalRemoveEventListener = g.removeEventListener
  const originalDispatchEvent = g.dispatchEvent
  const listeners: Record<string, TestEventListener[]> = {}
  g.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
    const fn: TestEventListener =
      typeof listener === 'function' ? listener : (event: Event) => listener.handleEvent(event)
    if (!listeners[type]) listeners[type] = []
    listeners[type].push(fn)
  }) as typeof g.addEventListener
  g.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
    const arr = listeners[type]
    if (!arr) return
    const fn: TestEventListener =
      typeof listener === 'function' ? listener : (event: Event) => listener.handleEvent(event)
    const index = arr.indexOf(fn)
    if (index >= 0) arr.splice(index, 1)
  }) as typeof g.removeEventListener
  g.dispatchEvent = ((event: Event) => {
    const type = event.type
    const arr = listeners[type]
    if (!arr || arr.length === 0) return true
    for (const fn of arr.slice()) {
      fn(event)
    }
    return true
  }) as typeof g.dispatchEvent
  g.getComputedStyle = () => ({ lineHeight: '16' } as unknown as CSSStyleDeclaration)
  g.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(performance.now() + 220)
    return 1
  }
  const restore = () => {
    if (originalGetComputedStyle) {
      g.getComputedStyle = originalGetComputedStyle
    }
    if (originalRequestAnimationFrame) {
      g.requestAnimationFrame = originalRequestAnimationFrame
    }
    if (originalAddEventListener) {
      g.addEventListener = originalAddEventListener
    }
    if (originalRemoveEventListener) {
      g.removeEventListener = originalRemoveEventListener
    }
    if (originalDispatchEvent) {
      g.dispatchEvent = originalDispatchEvent
    }
  }
  return { g, restore }
}

export type TextareaHarness = {
  textarea: HTMLTextAreaElement
  getFocusCount: () => number
  getSelection: () => { start: number | null; end: number | null }
}

export function createTextareaHarness(): TextareaHarness {
  let focusCount = 0
  let selectionStart: number | null = null
  let selectionEnd: number | null = null
  const textarea = {
    value: '',
    focus: () => {
      focusCount += 1
    },
    setSelectionRange: (start: number, end: number) => {
      selectionStart = start
      selectionEnd = end
    },
    scrollTop: 0,
    clientHeight: 200,
  } as unknown as HTMLTextAreaElement
  return {
    textarea,
    getFocusCount: () => focusCount,
    getSelection: () => ({ start: selectionStart, end: selectionEnd }),
  }
}
