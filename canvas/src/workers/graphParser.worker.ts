import type { GraphData } from '@/lib/graph/types'
import { parseGraph } from '@/lib/graph/io/adapter'

type ParseRequest = { type: 'parse'; id: number; name: string; text: string };
type ParseResponse = { id: number; ok: boolean; data: GraphData | null; error?: string };

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'parse') return
  try {
    const result = parseGraph(msg.name, msg.text).data
    const global = self as unknown as DedicatedWorkerGlobalScope;
    global.postMessage({ id: (msg as unknown as { id?: number }).id ?? 0, ok: true, data: result } as ParseResponse)
  } catch (err) {
    const global = self as unknown as DedicatedWorkerGlobalScope;
    const msg = String((err as Error)?.message || err as unknown as string)
    global.postMessage({ id: (e.data as unknown as { id?: number }).id ?? 0, ok: false, data: null, error: msg } as ParseResponse)
  }
}
