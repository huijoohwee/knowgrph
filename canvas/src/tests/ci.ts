import fs from 'node:fs'
import path from 'node:path'
import { createRequire, Module as NodeModule } from 'node:module'

const ensurePeerSymlinks = () => {
  try {
    const rootDir = process.cwd()
    const localRequire = createRequire(import.meta.url)
    const curagrphEntry = localRequire.resolve('curagrph', { paths: [rootDir] })
    const curagrphDir = fs.realpathSync(path.resolve(path.dirname(curagrphEntry), '..'))
    const curagrphNodeModules = path.join(curagrphDir, 'node_modules')
    fs.mkdirSync(curagrphNodeModules, { recursive: true })

    const link = (name: string) => {
      const src = path.join(rootDir, 'node_modules', name)
      const dest = path.join(curagrphNodeModules, name)
      if (!fs.existsSync(src)) return
      if (fs.existsSync(dest)) {
        try {
          const st = fs.lstatSync(dest)
          if (st.isSymbolicLink()) {
            const existing = fs.readlinkSync(dest)
            if (path.resolve(curagrphNodeModules, existing) === src) return
          } else {
            return
          }
        } catch {
          return
        }
        try {
          fs.rmSync(dest, { recursive: true, force: true })
        } catch {
          return
        }
      }
      fs.symlinkSync(src, dest, 'dir')
    }

    link('react')
    link('react-dom')
  } catch {
    void 0
  }
}

ensurePeerSymlinks()

type WindowStub = Pick<
  Window,
  'addEventListener' | 'removeEventListener' | 'dispatchEvent' | 'setTimeout' | 'clearTimeout'
> & {
  HTMLIFrameElement?: typeof HTMLIFrameElement
}

type GlobalWithWindowStub = typeof globalThis & { window?: WindowStub }

const g = globalThis as GlobalWithWindowStub

const appRequire = createRequire(import.meta.url)
const resolvedReact = appRequire.resolve('react', { paths: [process.cwd()] })
const resolvedReactJsxRuntime = appRequire.resolve('react/jsx-runtime', { paths: [process.cwd()] })
const resolvedReactJsxDevRuntime = appRequire.resolve('react/jsx-dev-runtime', { paths: [process.cwd()] })
const resolvedReactDom = appRequire.resolve('react-dom', { paths: [process.cwd()] })
const resolvedReactDomClient = appRequire.resolve('react-dom/client', { paths: [process.cwd()] })
const originalResolveFilename = (NodeModule as unknown as { _resolveFilename: unknown })._resolveFilename as (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) => string

;(NodeModule as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  switch (request) {
    case 'react':
      return originalResolveFilename(resolvedReact, parent, isMain, options)
    case 'react/jsx-runtime':
      return originalResolveFilename(resolvedReactJsxRuntime, parent, isMain, options)
    case 'react/jsx-dev-runtime':
      return originalResolveFilename(resolvedReactJsxDevRuntime, parent, isMain, options)
    case 'react-dom':
      return originalResolveFilename(resolvedReactDom, parent, isMain, options)
    case 'react-dom/client':
      return originalResolveFilename(resolvedReactDomClient, parent, isMain, options)
    default:
      return originalResolveFilename(request, parent, isMain, options)
  }
}

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
  const { runAllTests } = await import('@/tests/run')
  const startedAt = Date.now()
  const timeoutMs = (() => {
    const raw = Number(process.env.KG_TEST_TIMEOUT_MS)
    if (Number.isFinite(raw) && raw > 1_000) return Math.max(30_000, Math.min(30 * 60_000, Math.floor(raw)))
    return 10 * 60_000
  })()
  const results = await Promise.race([
    runAllTests(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`tests timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ])
  const finishedAt = Date.now()
  const durationMs = finishedAt - startedAt
  const failed = results.filter(r => !r.ok)
  results.forEach(r => {
    const tag = r.ok ? 'OK' : 'FAIL'
    console.log(`${tag} ${r.name}${r.error ? ` — ${r.error}` : ''}`)
  })
  const okCount = results.length - failed.length
  console.log(`SUMMARY total=${results.length} ok=${okCount} failed=${failed.length}`)
  if (failed.length > 0) {
    failed.forEach(r => {
      console.log(`FAIL ${r.name}${r.error ? ` — ${r.error}` : ''}`)
    })
  }
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
  process.exit(failed.length > 0 ? 1 : 0)
}

main()
