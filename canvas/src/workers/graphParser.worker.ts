import type { GraphData } from '@/lib/graph/types'
import { parseGraph } from '@/lib/graph/io/adapter'

type ParseRequest = { type: 'parse'; name: string; text: string };
type ParseResponse = { ok: boolean; data: GraphData | null; error?: string };

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'parse') return
  try {
    const result = parseGraph(msg.name, msg.text).data
    const global = self as unknown as DedicatedWorkerGlobalScope;
    global.postMessage({ ok: true, data: result } as ParseResponse)
  } catch (err) {
    const global = self as unknown as DedicatedWorkerGlobalScope;
    const msg = String((err as Error)?.message || err as unknown as string)
    global.postMessage({ ok: false, error: msg } as ParseResponse)
  }
}
