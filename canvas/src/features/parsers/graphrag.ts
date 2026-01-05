import { isGraphRagBundle, parseGraphRagBundle } from '@/lib/graph/graphrag'
import type { ParserSpec } from './types'
import { toParserId } from './types'

export const graphRagSpec: ParserSpec = {
  id: toParserId('graphrag'),
  name: 'GraphRAG Bundle',
  match: (_, text) => {
    try { const obj = JSON.parse(text); return isGraphRagBundle(obj) } catch { return false }
  },
  parse: (_, text) => {
    try {
      const obj = JSON.parse(text)
      return { graphData: parseGraphRagBundle(obj), warnings: [] }
    } catch (err: unknown) {
      const msg = (() => {
        const e = err as { message?: unknown }
        return String(e?.message ?? err)
      })()
      return { graphData: { context: 'graphrag', type: 'Graph', nodes: [], edges: [] }, warnings: [msg] }
    }
  }
}
