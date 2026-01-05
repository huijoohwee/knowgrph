import type { GraphData } from '@/lib/graph/types'

let worker: Worker | null = null
let reqId = 0
const pending = new Map<string, { resolve: (v: { graphData?: GraphData; warnings?: string[] }) => void; reject: (e: unknown) => void }>()

const getWorker = (): Worker => {
  if (worker) return worker
  worker = new Worker(new URL('./treeSitterWorker.ts', import.meta.url), { type: 'classic' })
  worker.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as { id: string; ok: boolean; graphData?: GraphData; warnings?: string[]; error?: string }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.ok) p.resolve({ graphData: msg.graphData, warnings: msg.warnings })
    else p.reject(new Error(msg.error || 'worker failed'))
  }
  return worker
}

export const parsePythonViaWorker = (name: string, text: string, timeoutMs = 4000): Promise<{ graphData: GraphData; warnings: string[] }> => {
  const w = getWorker()
  const id = `req:${++reqId}`
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error('worker timeout')) }, Math.max(100, timeoutMs))
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve({ graphData: v.graphData!, warnings: v.warnings || [] }) }, reject: (e) => { clearTimeout(t); reject(e) } })
    w.postMessage({ id, name, text })
  })
}
