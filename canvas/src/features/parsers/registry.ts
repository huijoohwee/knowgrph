import type { ParserSpec, ParseInput, ParseResult, ParserId } from './types'
import type { GraphData } from '@/lib/graph/types'

let specs: ParserSpec[] = []

export const listParsers = (): ParserSpec[] => specs.slice()

export const registerParser = (spec: ParserSpec) => {
  const idx = specs.findIndex(s => s.id === spec.id)
  if (idx >= 0) specs.splice(idx, 1)
  specs.push(spec)
}

export const unregisterParser = (id: string) => {
  specs = specs.filter(s => s.id !== id)
}

export const resetParsers = () => {
  specs = []
}

export const applyParser = (id: ParserId, input: ParseInput): ParseResult | null => {
  const s = specs.find(x => x.id === id)
  if (!s) return null
  try {
    return s.parse(input.name, input.text)
  } catch (err: unknown) {
    const empty: GraphData = { context: s.id, type: 'Graph', nodes: [], edges: [] }
    const msg = (() => {
      const e = err as { message?: unknown }
      return String(e?.message ?? err)
    })()
    return { graphData: empty, warnings: [msg] }
  }
}

export const applyParserAsync = async (id: ParserId, input: ParseInput): Promise<ParseResult | null> => {
  const s = specs.find(x => x.id === id)
  if (!s) return null
  try {
    if (typeof s.parseAsync === 'function') {
      return await s.parseAsync(input.name, input.text)
    }
    return s.parse(input.name, input.text)
  } catch (err: unknown) {
    const empty: GraphData = { context: s.id, type: 'Graph', nodes: [], edges: [] }
    const msg = (() => {
      const e = err as { message?: unknown }
      return String(e?.message ?? err)
    })()
    return { graphData: empty, warnings: [msg] }
  }
}

export const bestMatch = (input: ParseInput): ParserSpec | null => {
  for (const s of specs) {
    try { if (s.match(input.name, input.text)) return s } catch { void 0 }
  }
  return null
}
