import type { ParserSpec, ParseInput, ParseResult, ParserId } from './types'
import type { GraphData } from '@/lib/graph/types'
import { shouldPreferMarkdownParserInput } from './default'

let specs: ParserSpec[] = []
let registryRevision = 0

export const listParsers = (): ParserSpec[] => specs.slice()

export const registerParser = (spec: ParserSpec) => {
  const idx = specs.findIndex(s => s.id === spec.id)
  if (idx >= 0) specs.splice(idx, 1)
  specs.push(spec)
  registryRevision += 1
}

export const unregisterParser = (id: string) => {
  specs = specs.filter(s => s.id !== id)
  registryRevision += 1
}

export const resetParsers = () => {
  specs = []
  registryRevision += 1
}

export const getParserRegistryRevision = (): number => registryRevision

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
  if (shouldPreferMarkdownParserInput(input.name, input.text)) {
    const markdownSpec = specs.find(s => String(s.id) === 'markdown') || null
    if (markdownSpec) {
      try {
        if (markdownSpec.match(input.name, input.text)) return markdownSpec
      } catch {
        void 0
      }
    }
  }
  for (const s of specs) {
    try { if (s.match(input.name, input.text)) return s } catch { void 0 }
  }
  return null
}
