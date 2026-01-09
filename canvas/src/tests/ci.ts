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
