import type { ParserSpec } from '../types'
import { toParserId } from '../types'
import { parsePython } from './parser'
import { isTreeSitterEnabled } from '../config'
import { parsePythonViaWorker } from './tsWorkerClient'

export const pythonSpec: ParserSpec = {
  id: toParserId('python'),
  name: 'Python (.py)',
  match: (fname, body) => {
    const lower = (fname || '').toLowerCase()
    if (lower.endsWith('.py')) return true
    const t = (body || '')
    return /\b(def|class|import|from)\b/.test(t)
  },
  parse: (fname, body) => parsePython(fname, body),
  parseAsync: async (fname, body) => {
    if (isTreeSitterEnabled()) {
      try {
        return await parsePythonViaWorker(fname, body)
      } catch { void 0 }
    }
    return parsePython(fname, body)
  },
}
