import { deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'

type DeriveKeywordGraphRequest = {
  type: 'deriveKeywordGraph'
  id: number
  documentId: string
  documentText: string
  sourceLabel?: string
  sourceTextHash?: string
  tuning?: { edgesPerNode?: number; maxEdgesCap?: number }
}

type DeriveKeywordGraphResponse = {
  id: number
  ok: boolean
  graph: unknown | null
  error?: string
}

const ctx = self as unknown as {
  postMessage: (msg: unknown) => void
  onmessage: ((ev: MessageEvent<DeriveKeywordGraphRequest>) => void) | null
}

ctx.onmessage = (e: MessageEvent<DeriveKeywordGraphRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'deriveKeywordGraph') return
  const id = typeof msg.id === 'number' ? msg.id : 0
  try {
    const derived = deriveKeywordGraphFromText({
      documentId: String(msg.documentId || 'doc'),
      documentText: String(msg.documentText || ''),
      sourceLabel: typeof msg.sourceLabel === 'string' ? msg.sourceLabel : undefined,
      sourceTextHash: typeof msg.sourceTextHash === 'string' ? msg.sourceTextHash : undefined,
      tuning:
        msg.tuning && typeof msg.tuning === 'object' && !Array.isArray(msg.tuning)
          ? {
              edgesPerNode: typeof msg.tuning.edgesPerNode === 'number' ? msg.tuning.edgesPerNode : undefined,
              maxEdgesCap: typeof msg.tuning.maxEdgesCap === 'number' ? msg.tuning.maxEdgesCap : undefined,
            }
          : undefined,
    })
    const out: DeriveKeywordGraphResponse = { id, ok: true, graph: derived.graph }
    ctx.postMessage(out)
  } catch (err: unknown) {
    const message = (() => {
      const e2 = err as { message?: unknown }
      return String(e2?.message ?? err)
    })()
    const out: DeriveKeywordGraphResponse = { id, ok: false, graph: null, error: message }
    ctx.postMessage(out)
  }
}
