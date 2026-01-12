import { runAllTests } from '@/tests/run'
import fs from 'node:fs'
import path from 'node:path'

type WindowStub = Pick<
  Window,
  'addEventListener' | 'removeEventListener' | 'dispatchEvent' | 'setTimeout' | 'clearTimeout'
> & {
  HTMLIFrameElement?: typeof HTMLIFrameElement
}

type GlobalWithWindowStub = typeof globalThis & { window?: WindowStub }

const g = globalThis as GlobalWithWindowStub

if (!g.window) {
  const stub = {} as WindowStub
  stub.addEventListener = () => {}
  stub.removeEventListener = () => {}
  stub.dispatchEvent = () => false
  stub.setTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
    setTimeout(handler as (...inner: unknown[]) => void, timeout, ...args) as unknown as number
  stub.clearTimeout = (handle: number) => clearTimeout(handle)
  try {
    const ctor = typeof HTMLIFrameElement !== 'undefined' ? HTMLIFrameElement : class {}
    stub.HTMLIFrameElement = ctor as typeof HTMLIFrameElement
  } catch {
    stub.HTMLIFrameElement = class {} as typeof HTMLIFrameElement
  }
  g.window = stub as Window & typeof globalThis & WindowStub
} else if (!g.window.HTMLIFrameElement) {
  try {
    const ctor = typeof HTMLIFrameElement !== 'undefined' ? HTMLIFrameElement : class {}
    g.window.HTMLIFrameElement = ctor as typeof HTMLIFrameElement
  } catch {
    g.window.HTMLIFrameElement = class {} as typeof HTMLIFrameElement
  }
}

if (!g.window.requestAnimationFrame) {
  g.window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 0) as unknown as number
  }
}
if (!g.window.cancelAnimationFrame) {
  g.window.cancelAnimationFrame = (id: number) => {
    clearTimeout(id)
  }
}

if (!g.NodeFilter) {
  g.NodeFilter = {
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
  } as unknown as {
    readonly FILTER_ACCEPT: 1
    readonly FILTER_REJECT: 2
    readonly FILTER_SKIP: 3
    readonly SHOW_ALL: 4294967295
    readonly SHOW_ELEMENT: 1
    readonly SHOW_ATTRIBUTE: 2
    readonly SHOW_TEXT: 4
    readonly SHOW_CDATA_SECTION: 8
    readonly SHOW_ENTITY_REFERENCE: 16
    readonly SHOW_ENTITY: 32
    readonly SHOW_PROCESSING_INSTRUCTION: 64
    readonly SHOW_COMMENT: 128
    readonly SHOW_DOCUMENT: 256
    readonly SHOW_DOCUMENT_TYPE: 512
    readonly SHOW_DOCUMENT_FRAGMENT: 1024
    readonly SHOW_NOTATION: 2048
  }
}

if (!g.ResizeObserver) {
  g.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

async function main() {
  const startedAt = Date.now()
  const results = await runAllTests()
  const finishedAt = Date.now()
  const durationMs = finishedAt - startedAt
  const failed = results.filter(r => !r.ok)
  results.forEach(r => {
    const tag = r.ok ? 'OK' : 'FAIL'
    console.log(`${tag} ${r.name}${r.error ? ` — ${r.error}` : ''}`)
  })
  try {
    const rootDir = path.resolve(process.cwd(), '..')
    const logDir = path.join(rootDir, 'data', 'outputs')
    const logPath = path.join(logDir, 'runtime-events.jsonl')
    fs.mkdirSync(logDir, { recursive: true })
    const payload = {
      key: 'runtime:event:canvas:tests:runAllTests',
      node_id: 'canvas/src/tests/run.ts',
      eventType: 'call',
      status: failed.length > 0 ? 'error' : 'ok',
      durationMs,
      stackTraceSnippet: 'canvas/src/tests/run.ts: runAllTests',
    }
    fs.appendFileSync(logPath, JSON.stringify(payload) + '\n', { encoding: 'utf8' })
  } catch {
    void 0
  }
  if (failed.length > 0) {
    process.exitCode = 1
  } else {
    process.exitCode = 0
  }
}

main()
